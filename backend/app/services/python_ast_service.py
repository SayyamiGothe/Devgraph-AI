import ast
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------
# data shapes
# ----------------------------------------------------------------------


@dataclass
class CodeNode:
    fqn: str
    name: str
    kind: str  # module | class | function
    file_path: str  # repo-relative
    start_line: int
    end_line: int
    signature: str = ""
    docstring: str = ""
    decorators: list = field(default_factory=list)
    is_async: bool = False

    # RAW base-class names. They cannot be resolved during pass 1
    # because resolution depends on the module's imports.
    bases: list = field(default_factory=list)


@dataclass
class RawCall:
    caller_fqn: str
    enclosing_class: str | None
    raw_name: str
    line: int


@dataclass
class ParsedModule:
    module_fqn: str
    file_path: str
    is_package: bool
    nodes: list
    calls: list
    alias_map: dict  # local name -> target fqn
    imports: list  # raw module targets
    source: str

    # Cheap local type inference, the thing that makes method calls
    # resolvable at all:
    #   local_types[function_fqn][var_name] = raw class name
    #   attr_types[class_fqn][attr_name]    = raw class name
    local_types: dict = field(default_factory=dict)
    attr_types: dict = field(default_factory=dict)


# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------


def module_fqn_from_path(path: Path, repo_root: Path) -> tuple[str, bool]:
    """
    app/services/x.py        -> ("app.services.x", False)
    app/services/__init__.py -> ("app.services",   True)
    """
    rel = path.relative_to(repo_root)
    parts = list(rel.parts)

    is_package = parts[-1] == "__init__.py"

    if is_package:
        parts = parts[:-1]
    else:
        parts[-1] = parts[-1][: -len(".py")]

    return ".".join(parts), is_package


CHUNK_MAX_CHARS = 1500


def build_chunk_text(node, source_lines) -> str:
    """
    A header plus the exact source slice.

    The header is embedded along with the code, which measurably helps
    retrieval: a question like "what is in document_service.py" has
    nothing to match against otherwise.
    """
    body = "\n".join(source_lines[node.start_line - 1: node.end_line])

    header = (
        f"# file: {node.file_path}:{node.start_line}-{node.end_line}\n"
        f"# fqn: {node.fqn}\n"
    )

    if node.signature:
        header += f"# signature: {node.signature}\n"

    return header + "\n" + body


def build_module_chunk(module) -> str | None:
    """Module-level imports and constants: everything before the first def."""
    lines = module.source.splitlines()

    definitions = [
        n.start_line for n in module.nodes if n.kind in ("class", "function")
    ]

    end = (min(definitions) - 1) if definitions else len(lines)

    body = "\n".join(lines[:end]).strip()

    if not body:
        return None

    header = (
        f"# file: {module.file_path}:1-{end}\n"
        f"# fqn: {module.module_fqn}\n"
        f"# module-level imports and constants\n"
    )

    return header + "\n" + body


def _dotted(node) -> str | None:
    """Flatten a Name/Attribute chain into 'a.b.c'."""
    if isinstance(node, ast.Name):
        return node.id

    if isinstance(node, ast.Attribute):
        base = _dotted(node.value)
        return f"{base}.{node.attr}" if base else None

    # Subscripts, lambdas, chained calls like foo().bar() -> not addressable
    return None


def _signature(node) -> str:
    try:
        args = ast.unparse(node.args)
        returns = f" -> {ast.unparse(node.returns)}" if node.returns else ""
        return f"{node.name}({args}){returns}"
    except Exception:
        return f"{node.name}(...)"


# ----------------------------------------------------------------------
# pass 1 - per file
# ----------------------------------------------------------------------


class _ModuleVisitor(ast.NodeVisitor):
    """
    Walks one module with an explicit scope stack.

    ast.walk() is deliberately NOT used: it yields nodes without parent
    information, so a method would come out as a bare name with no idea
    which class it belongs to.
    """

    def __init__(self, module_fqn: str, file_path: str, is_package: bool):
        self.module_fqn = module_fqn
        self.file_path = file_path
        self.is_package = is_package

        self.scope = [module_fqn]  # enclosing fqn stack
        self.scope_kinds = ["module"]  # parallel to scope
        self.class_stack = []  # innermost VISIBLE class, for self.x

        self.nodes = []
        self.calls = []
        self.alias_map = {}
        self.imports = []
        self.local_types = {}
        self.attr_types = {}

    # ---- definitions ----

    def visit_ClassDef(self, node):
        fqn = f"{self.scope[-1]}.{node.name}"

        self.nodes.append(
            CodeNode(
                fqn=fqn,
                name=node.name,
                kind="class",
                file_path=self.file_path,
                start_line=node.lineno,
                end_line=node.end_lineno or node.lineno,
                docstring=(ast.get_docstring(node) or "")[:1000],
                decorators=[d for d in map(_dotted, node.decorator_list) if d],
                bases=[b for b in map(_dotted, node.bases) if b],
            )
        )

        self.scope.append(fqn)
        self.scope_kinds.append("class")
        self.class_stack.append(fqn)

        self.generic_visit(node)

        self.class_stack.pop()
        self.scope_kinds.pop()
        self.scope.pop()

    def _visit_function(self, node, is_async: bool):
        fqn = f"{self.scope[-1]}.{node.name}"

        self.nodes.append(
            CodeNode(
                fqn=fqn,
                name=node.name,
                kind="function",
                file_path=self.file_path,
                start_line=node.lineno,
                end_line=node.end_lineno or node.lineno,
                signature=_signature(node),
                docstring=(ast.get_docstring(node) or "")[:1000],
                decorators=[d for d in map(_dotted, node.decorator_list) if d],
                is_async=is_async,
            )
        )

        parent_is_class = self.scope_kinds[-1] == "class"

        self.scope.append(fqn)
        self.scope_kinds.append("function")

        # A method keeps its class visible so `self.x` resolves.
        # A function nested inside another function must NOT, or its
        # bare calls would wrongly resolve as methods of an outer class.
        if parent_is_class and self.class_stack:
            self.class_stack.append(self.class_stack[-1])
        else:
            self.class_stack.append(None)

        self.generic_visit(node)

        self.class_stack.pop()
        self.scope_kinds.pop()
        self.scope.pop()

    def visit_FunctionDef(self, node):
        self._visit_function(node, False)

    def visit_AsyncFunctionDef(self, node):
        self._visit_function(node, True)

    # ---- imports ----

    def visit_Import(self, node):
        for alias in node.names:

            if alias.asname:
                self.alias_map[alias.asname] = alias.name
            else:
                # `import a.b.c` binds only `a`; call sites already
                # write the full dotted path, so map the root to itself.
                root = alias.name.split(".")[0]
                self.alias_map[root] = root

            self.imports.append(alias.name)

    def visit_ImportFrom(self, node):
        base = self._resolve_relative(node.module, node.level)

        if base is None:
            return

        for alias in node.names:

            if alias.name == "*":
                continue

            local = alias.asname or alias.name

            self.alias_map[local] = (
                f"{base}.{alias.name}" if base else alias.name
            )

        if base:
            self.imports.append(base)

    def _resolve_relative(self, module, level):
        """
        `from . import x` / `from ..core import y` -> absolute fqn.

        Relative imports are extremely common. If this is wrong the
        edges vanish silently: node counts look healthy and only the
        edge count is quietly too low.
        """
        if not level:
            return module

        parts = self.module_fqn.split(".") if self.module_fqn else []

        # For a package (__init__.py) its own fqn IS the package;
        # for a module, drop the module name to get its package.
        pkg = parts if self.is_package else parts[:-1]

        if level > 1:
            drop = level - 1
            pkg = pkg[:-drop] if drop <= len(pkg) else []

        if module:
            return ".".join(pkg + [module]) if pkg else module

        return ".".join(pkg)

    # ---- assignments (local type inference) ----

    def visit_Assign(self, node):
        """
        Record `x = SomeClass(...)` so that a later `x.method()` can be
        resolved precisely instead of falling back to a name guess.

        This is what makes the common service/repository style
        resolvable:
            service = DocumentService(db)      -> local_types
            self.repo = ChunkRepository(db)    -> attr_types
        """
        if isinstance(node.value, ast.Call):

            class_raw = _dotted(node.value.func)

            if class_raw:
                for target in node.targets:

                    if isinstance(target, ast.Name):
                        self.local_types.setdefault(
                            self.scope[-1], {}
                        )[target.id] = class_raw

                    elif (
                        isinstance(target, ast.Attribute)
                        and isinstance(target.value, ast.Name)
                        and target.value.id == "self"
                        and self.class_stack
                        and self.class_stack[-1]
                    ):
                        self.attr_types.setdefault(
                            self.class_stack[-1], {}
                        )[target.attr] = class_raw

        self.generic_visit(node)

    # ---- calls ----

    def visit_Call(self, node):
        raw = _dotted(node.func)

        if raw:
            enclosing = self.class_stack[-1] if self.class_stack else None

            self.calls.append(
                RawCall(
                    caller_fqn=self.scope[-1],
                    enclosing_class=enclosing,
                    raw_name=raw,
                    line=node.lineno,
                )
            )

        self.generic_visit(node)


class PythonAstService:

    def parse_file(self, abs_path: Path, repo_root: Path) -> ParsedModule | None:
        """Returns None if the file cannot be parsed (caller counts it as skipped)."""

        rel_path = str(abs_path.relative_to(repo_root)).replace("\\", "/")
        module_fqn, is_package = module_fqn_from_path(abs_path, repo_root)

        try:
            source = abs_path.read_text(encoding="utf-8", errors="replace")
            tree = ast.parse(source)
        except (SyntaxError, ValueError, OSError, RecursionError) as exc:
            # A real repo will contain a Python 2 file or a template with
            # placeholders. One bad file must not abort a 500-file ingest.
            logger.warning("Skipping %s: %s", rel_path, exc)
            return None

        visitor = _ModuleVisitor(module_fqn, rel_path, is_package)
        visitor.visit(tree)

        module_node = CodeNode(
            fqn=module_fqn,
            name=module_fqn.rsplit(".", 1)[-1] if module_fqn else "<root>",
            kind="module",
            file_path=rel_path,
            start_line=1,
            end_line=len(source.splitlines()) or 1,
            docstring=(ast.get_docstring(tree) or "")[:1000],
        )

        return ParsedModule(
            module_fqn=module_fqn,
            file_path=rel_path,
            is_package=is_package,
            nodes=[module_node] + visitor.nodes,
            calls=visitor.calls,
            alias_map=visitor.alias_map,
            imports=visitor.imports,
            source=source,
            local_types=visitor.local_types,
            attr_types=visitor.attr_types,
        )

    def parse_repository(self, py_files, repo_root: Path):
        """Returns (modules, skipped_count)."""
        modules = []
        skipped = 0

        for path in py_files:
            parsed = self.parse_file(path, repo_root)

            if parsed is None:
                skipped += 1
                continue

            modules.append(parsed)

        return modules, skipped


# ----------------------------------------------------------------------
# pass 2 - cross-file resolution
# ----------------------------------------------------------------------


class SymbolResolver:

    def __init__(self, modules):
        self.symbols = {}

        for module in modules:
            for node in module.nodes:
                self.symbols[node.fqn] = node

        self.by_suffix = defaultdict(list)

        for fqn in self.symbols:
            self.by_suffix[fqn.rsplit(".", 1)[-1]].append(fqn)

        # diagnostics
        self.resolved_calls = 0
        self.unresolved_calls = defaultdict(int)

    def _unique_suffix(self, name):
        """
        Ambiguity must lose the edge, not guess.

        A missing CALLS edge degrades an answer; a WRONG one corrupts it,
        because it makes the LLM claim a change is safe when it is not.
        """
        matches = self.by_suffix.get(name, [])
        return matches[0] if len(matches) == 1 else None

    def _resolve_class(self, class_raw, alias_map, module_fqn):
        """Turn a raw class name into the fqn of a known class node."""
        if not class_raw:
            return None

        parts = class_raw.split(".")

        for i in range(len(parts), 0, -1):
            prefix = ".".join(parts[:i])
            if prefix in alias_map:
                candidate = ".".join([alias_map[prefix]] + parts[i:])
                if candidate in self.symbols:
                    return candidate
                break

        if module_fqn:
            candidate = f"{module_fqn}.{class_raw}"
            if candidate in self.symbols:
                return candidate

        if class_raw in self.symbols:
            return class_raw

        return self._unique_suffix(parts[-1])

    def resolve(
        self,
        raw,
        enclosing_class,
        alias_map,
        module_fqn,
        caller_fqn=None,
        local_types=None,
        attr_types=None,
    ):
        if not raw:
            return None

        local_types = local_types or {}
        attr_types = attr_types or {}

        parts = raw.split(".")

        # 1. self.x / cls.x inside a class
        if parts[0] in ("self", "cls"):

            # 1a. self.<attr>.<method> where <attr> has an inferred type
            if len(parts) >= 3 and enclosing_class:
                attr_class = attr_types.get(enclosing_class, {}).get(parts[1])

                if attr_class:
                    owner = self._resolve_class(
                        attr_class, alias_map, module_fqn
                    )
                    if owner:
                        candidate = ".".join([owner] + parts[2:])
                        if candidate in self.symbols:
                            return candidate

            # 1b. self.<method> on the enclosing class
            if enclosing_class:
                candidate = ".".join([enclosing_class] + parts[1:])
                if candidate in self.symbols:
                    return candidate

            # `self.<method>` may still be inherited, so a name guess is
            # reasonable. But `self.<attr>.<method>` with an untyped attr
            # is NOT: self.db.refresh() would otherwise match an unrelated
            # endpoint named refresh and fabricate an edge.
            if len(parts) == 2:
                return self._unique_suffix(parts[-1])

            return None

        # 2. <local var>.<method> where the var has an inferred type
        if len(parts) >= 2 and caller_fqn:
            var_class = local_types.get(caller_fqn, {}).get(parts[0])

            if var_class:
                owner = self._resolve_class(var_class, alias_map, module_fqn)
                if owner:
                    candidate = ".".join([owner] + parts[1:])
                    if candidate in self.symbols:
                        return candidate

        # 3. import alias expansion, longest prefix first
        for i in range(len(parts), 0, -1):
            prefix = ".".join(parts[:i])

            if prefix in alias_map:
                candidate = ".".join([alias_map[prefix]] + parts[i:])
                if candidate in self.symbols:
                    return candidate
                break

        # 4. same-module sibling
        if module_fqn:
            candidate = f"{module_fqn}.{raw}"
            if candidate in self.symbols:
                return candidate

        # 5. exact global hit
        if raw in self.symbols:
            return raw

        # 6. unique suffix match - ONLY for bare names.
        # For `receiver.method()` where the receiver's type is unknown,
        # matching on the method name alone invents edges between
        # unrelated code that happens to share a name.
        if len(parts) == 1:
            return self._unique_suffix(raw)

        return None

    def build_edges(self, modules):
        edges = []

        for module in modules:

            # ---- DEFINES: parent -> child, derived from the fqn ----
            for node in module.nodes:
                if node.kind == "module":
                    continue

                parent = node.fqn.rsplit(".", 1)[0]

                if parent in self.symbols:
                    edges.append((parent, node.fqn, "DEFINES"))

            # ---- IMPORTS: module -> module ----
            for target in module.imports:
                node = self.symbols.get(target)

                if node is not None and node.kind == "module":
                    if target != module.module_fqn:
                        edges.append((module.module_fqn, target, "IMPORTS"))

            # ---- INHERITS: class -> class ----
            for node in module.nodes:
                for base in node.bases:
                    resolved = self.resolve(
                        base,
                        None,
                        module.alias_map,
                        module.module_fqn,
                    )

                    if resolved and resolved != node.fqn:
                        edges.append((node.fqn, resolved, "INHERITS"))

            # ---- CALLS: caller -> callee ----
            for call in module.calls:
                resolved = self.resolve(
                    call.raw_name,
                    call.enclosing_class,
                    module.alias_map,
                    module.module_fqn,
                    caller_fqn=call.caller_fqn,
                    local_types=module.local_types,
                    attr_types=module.attr_types,
                )

                if resolved is None:
                    self.unresolved_calls[call.raw_name] += 1
                    continue

                self.resolved_calls += 1

                if resolved != call.caller_fqn:
                    edges.append((call.caller_fqn, resolved, "CALLS"))

        # Dedupe: a call inside a loop is one edge, not fifty.
        return sorted(set(edges))

    def stats(self):
        total_unresolved = sum(self.unresolved_calls.values())
        total = self.resolved_calls + total_unresolved

        return {
            "symbols": len(self.symbols),
            "calls_total": total,
            "calls_resolved": self.resolved_calls,
            "calls_unresolved": total_unresolved,
            "resolution_rate": (
                self.resolved_calls / total if total else 0.0
            ),
            "top_unresolved": sorted(
                self.unresolved_calls.items(),
                key=lambda kv: kv[1],
                reverse=True,
            )[:20],
        }
