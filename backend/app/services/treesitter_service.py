"""
Generic tree-sitter extractor for non-Python languages.

Produces exactly the same CodeNode / RawCall / ParsedModule shapes as
PythonAstService, so SymbolResolver, the chunk builders, the Neo4j writer
and the whole downstream pipeline are unchanged.

Where this differs from the Python path: tree-sitter gives a concrete
syntax tree with no name resolution and no semantics. So definitions and
nesting are reliable, while CALLS edges lean on the resolver's
same-file -> import -> unique-suffix ladder, with ambiguity dropping the
edge rather than guessing.
"""

import logging
from pathlib import Path

from app.services.language_config import LanguageSpec, spec_for
from app.services.python_ast_service import CodeNode, ParsedModule, RawCall

logger = logging.getLogger(__name__)

_parsers = {}

#: Node types whose text is a usable identifier when no `name` field exists.
_NAME_NODE_TYPES = (
    "identifier",
    "type_identifier",
    "property_identifier",
    "field_identifier",
    "constant",
    "name",
    "word",
)

#: Fields that hold the callee, in grammar preference order.
_CALLEE_FIELDS = ("function", "name", "method", "constructor")


def get_parser_for(spec: LanguageSpec):
    """Parsers are reused: constructing one per file is measurable overhead."""
    if spec.name not in _parsers:
        from tree_sitter_language_pack import get_parser

        _parsers[spec.name] = get_parser(spec.name)

    return _parsers[spec.name]


def module_fqn_from_path(path: Path, repo_root: Path) -> str:
    """
    src/app/Service.java -> src.app.Service
    web/util/index.js    -> web.util          (index is the package entry)
    """
    rel = path.relative_to(repo_root)
    parts = list(rel.parts)

    stem = Path(parts[-1]).stem

    if stem in ("index", "mod", "__init__"):
        parts = parts[:-1]
    else:
        parts[-1] = stem

    return ".".join(parts)


def _text(node, source: bytes) -> str:
    return source[node.start_byte:node.end_byte].decode("utf-8", "replace")


def _normalise(raw: str) -> str:
    """`a::b`, `a->b`, `a:b` all mean the same thing as `a.b` to the resolver."""
    return (
        raw.replace("::", ".")
        .replace("->", ".")
        .replace("?.", ".")
        .strip()
    )


def _name_of(node, source: bytes) -> str | None:
    """
    Most grammars expose a `name` field. C and C++ bury it inside
    function_declarator, and some grammars use no field at all.
    """
    field = node.child_by_field_name("name")

    if field is not None:
        return _text(field, source).strip()

    declarator = node.child_by_field_name("declarator")

    while declarator is not None:
        inner = declarator.child_by_field_name("declarator")

        if inner is None:
            break

        declarator = inner

    if declarator is not None:
        text = _text(declarator, source).strip()
        # `run(int x)` -> `run`
        return text.split("(")[0].strip() or None

    for child in node.named_children:
        if child.type in _NAME_NODE_TYPES:
            return _text(child, source).strip()

    return None


def _signature_of(node, source: bytes, name: str) -> str:
    """First line of the declaration, minus any body."""
    params = node.child_by_field_name("parameters")

    if params is not None:
        rendered = " ".join(_text(params, source).split())
        return f"{name}{rendered}"

    text = _text(node, source)
    first = text.split("\n", 1)[0].strip()

    for opener in ("{", "=>", ":"):
        if opener in first:
            first = first.split(opener, 1)[0].strip()
            break

    return first[:300] or name


def _callee_name(node, source: bytes) -> str | None:
    for fname in _CALLEE_FIELDS:
        field = node.child_by_field_name(fname)

        if field is not None:
            raw = _normalise(_text(field, source))
            break
    else:
        if not node.named_children:
            return None
        raw = _normalise(_text(node.named_children[0], source))

    # Reject anything that is not a plain dotted path: computed members,
    # immediately-invoked expressions, template literals.
    if not raw or any(ch in raw for ch in "()[]{}\"'`<>+ \n\t,;"):
        return None

    parts = [p for p in raw.split(".") if p]

    if not parts:
        return None

    return ".".join(parts)


class TreeSitterService:
    """Mirror of PythonAstService.parse_file / parse_repository."""

    def parse_file(self, abs_path: Path, repo_root: Path) -> ParsedModule | None:
        extension = abs_path.suffix.lower()
        spec = spec_for(extension)

        if spec is None:
            return None

        rel_path = str(abs_path.relative_to(repo_root)).replace("\\", "/")
        module_fqn = module_fqn_from_path(abs_path, repo_root)

        try:
            raw_bytes = abs_path.read_bytes()
            parser = get_parser_for(spec)
            tree = parser.parse(raw_bytes)
        except Exception as exc:
            # A missing grammar or unreadable file must not abort the ingest.
            logger.warning("Skipping %s: %s", rel_path, exc)
            return None

        source = raw_bytes
        text = raw_bytes.decode("utf-8", "replace")

        nodes = []
        calls = []
        alias_map = {}
        imports = []

        self._walk(
            tree.root_node,
            source=source,
            spec=spec,
            module_fqn=module_fqn,
            rel_path=rel_path,
            scope=[module_fqn],
            class_stack=[],
            nodes=nodes,
            calls=calls,
            alias_map=alias_map,
            imports=imports,
        )

        module_node = CodeNode(
            fqn=module_fqn,
            name=module_fqn.rsplit(".", 1)[-1] if module_fqn else "<root>",
            kind="module",
            file_path=rel_path,
            start_line=1,
            end_line=len(text.splitlines()) or 1,
            language=spec.name,
        )

        return ParsedModule(
            module_fqn=module_fqn,
            file_path=rel_path,
            is_package=False,
            nodes=[module_node] + nodes,
            calls=calls,
            alias_map=alias_map,
            imports=imports,
            source=text,
            language=spec.name,
        )

    # ------------------------------------------------------------------

    def _walk(
        self,
        node,
        *,
        source,
        spec,
        module_fqn,
        rel_path,
        scope,
        class_stack,
        nodes,
        calls,
        alias_map,
        imports,
    ):
        node_type = node.type

        is_class = node_type in spec.class_types
        is_function = node_type in spec.function_types
        pushed = False

        if node_type in spec.import_types:
            self._record_import(node, source, spec, alias_map, imports)

        if is_class or is_function:
            name = _name_of(node, source)

            if name:
                fqn = f"{scope[-1]}.{name}" if scope[-1] else name
                kind = "class" if is_class else "function"

                nodes.append(
                    CodeNode(
                        fqn=fqn,
                        name=name,
                        kind=kind,
                        file_path=rel_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        signature=(
                            "" if is_class else _signature_of(node, source, name)
                        ),
                        language=spec.name,
                        bases=(
                            self._base_names(node, source) if is_class else []
                        ),
                    )
                )

                scope.append(fqn)
                pushed = True

                if is_class:
                    class_stack.append(fqn)
                else:
                    # A method keeps its class visible; a function nested
                    # inside a function must not inherit one.
                    parent_is_class = len(scope) > 1 and any(
                        n.fqn == scope[-2] and n.kind == "class" for n in nodes
                    )
                    class_stack.append(
                        class_stack[-1]
                        if parent_is_class and class_stack
                        else None
                    )

        elif spec.calls_supported and node_type in spec.call_types:
            raw = _callee_name(node, source)

            if raw:
                calls.append(
                    RawCall(
                        caller_fqn=scope[-1],
                        enclosing_class=class_stack[-1] if class_stack else None,
                        raw_name=raw,
                        line=node.start_point[0] + 1,
                    )
                )

        for child in node.children:
            self._walk(
                child,
                source=source,
                spec=spec,
                module_fqn=module_fqn,
                rel_path=rel_path,
                scope=scope,
                class_stack=class_stack,
                nodes=nodes,
                calls=calls,
                alias_map=alias_map,
                imports=imports,
            )

        if pushed:
            scope.pop()
            class_stack.pop()

    # ------------------------------------------------------------------

    def _base_names(self, node, source) -> list:
        """Superclasses / implemented interfaces, where the grammar names them."""
        names = []

        for field in ("superclass", "interfaces", "trait", "extends"):
            child = node.child_by_field_name(field)

            if child is None:
                continue

            for part in _normalise(_text(child, source)).split(","):
                cleaned = (
                    part.replace("extends", "")
                    .replace("implements", "")
                    .replace(":", "")
                    .strip()
                )

                if cleaned and cleaned.replace(".", "").replace("_", "").isalnum():
                    names.append(cleaned)

        return names

    def _record_import(self, node, source, spec, alias_map, imports):
        """
        Collect imported local names and the module they came from.

        The local names are what matter: they let the resolver's alias
        step fire. Resolving a specifier like './util' to a concrete file
        is only attempted for the JS/TS family, where it is unambiguous.
        """
        text = _text(node, source)

        source_node = node.child_by_field_name("source")
        specifier = None

        if source_node is not None:
            specifier = _text(source_node, source).strip("\"'`")

        for child in node.named_children:
            if child.type in ("import_clause", "named_imports", "import_specifier"):
                for leaf in self._identifiers(child, source):
                    alias_map.setdefault(leaf, leaf)

        if specifier:
            imports.append(specifier)
        else:
            # Grammars without a `source` field (Java, Go, Rust, PHP...):
            # take the dotted path out of the statement text.
            for token in text.replace(";", " ").split():
                cleaned = _normalise(token.strip("\"'`{}()"))

                if "." in cleaned and cleaned[0].isalpha():
                    imports.append(cleaned)
                    alias_map.setdefault(cleaned.rsplit(".", 1)[-1], cleaned)
                    break

    def _identifiers(self, node, source) -> list:
        found = []

        if node.type in _NAME_NODE_TYPES:
            found.append(_text(node, source).strip())

        for child in node.named_children:
            found.extend(self._identifiers(child, source))

        return found

    # ------------------------------------------------------------------

    def parse_repository(self, files, repo_root: Path):
        """Returns (modules, skipped_count)."""
        modules = []
        skipped = 0

        for path in files:
            parsed = self.parse_file(path, repo_root)

            if parsed is None:
                skipped += 1
                continue

            modules.append(parsed)

        return modules, skipped
