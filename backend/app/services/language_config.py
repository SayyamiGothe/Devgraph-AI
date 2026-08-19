"""
Per-language tree-sitter node-type configuration.

The node type names below were read out of the real grammars rather than
recalled, because they differ per language in ways that are easy to get
wrong: a function is `function_definition` in Python and C,
`function_declaration` in Go and JavaScript, `method_declaration` in
Java, `function_item` in Rust, and plain `method` in Ruby.

`calls_supported` is the honest part. Every configured language yields
definitions, nesting and embedded chunks. CALLS edges are only produced
where the grammar exposes call sites we can name AND a wrong edge is
unlikely, because a fabricated CALLS edge makes an LLM claim a change is
safe when it is not.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class LanguageSpec:
    #: tree_sitter_language_pack name
    name: str

    #: file extensions that map to this grammar
    extensions: tuple

    #: node types that open a class-like scope
    class_types: frozenset = field(default_factory=frozenset)

    #: node types that define a callable
    function_types: frozenset = field(default_factory=frozenset)

    #: node types that represent a call site
    call_types: frozenset = field(default_factory=frozenset)

    #: node types that declare an import / use / include
    import_types: frozenset = field(default_factory=frozenset)

    #: module / namespace / package scoping declarations
    namespace_types: frozenset = field(default_factory=frozenset)

    #: whether to emit CALLS edges at all for this language
    calls_supported: bool = True

    #: relative import specifiers resolve to sibling files (JS/TS family)
    relative_file_imports: bool = False


def _spec(**kwargs) -> LanguageSpec:
    for key in (
        "class_types",
        "function_types",
        "call_types",
        "import_types",
        "namespace_types",
    ):
        if key in kwargs:
            kwargs[key] = frozenset(kwargs[key])
    return LanguageSpec(**kwargs)


# ---------------------------------------------------------------------------
# JavaScript / TypeScript family
# ---------------------------------------------------------------------------

_JS_CLASSES = {"class_declaration", "class", "interface_declaration"}
_JS_FUNCTIONS = {
    "function_declaration",
    "function",
    "function_expression",
    "generator_function_declaration",
    "method_definition",
    "arrow_function",
}
_JS_CALLS = {"call_expression", "new_expression"}
_JS_IMPORTS = {"import_statement", "export_statement"}

JAVASCRIPT = _spec(
    name="javascript",
    extensions=(".js", ".mjs", ".cjs", ".jsx"),
    class_types=_JS_CLASSES,
    function_types=_JS_FUNCTIONS,
    call_types=_JS_CALLS,
    import_types=_JS_IMPORTS,
    relative_file_imports=True,
)

TYPESCRIPT = _spec(
    name="typescript",
    extensions=(".ts", ".mts", ".cts"),
    # type_alias_declaration matters more than it looks: modern TS
    # codebases often declare their whole API surface as
    # `export type X = { ... }` and contain no classes at all.
    class_types=_JS_CLASSES
    | {
        "abstract_class_declaration",
        "enum_declaration",
        "type_alias_declaration",
    },
    function_types=_JS_FUNCTIONS | {"function_signature", "method_signature"},
    call_types=_JS_CALLS,
    import_types=_JS_IMPORTS,
    relative_file_imports=True,
)

TSX = _spec(
    name="tsx",
    extensions=(".tsx",),
    class_types=TYPESCRIPT.class_types,
    function_types=TYPESCRIPT.function_types,
    call_types=_JS_CALLS,
    import_types=_JS_IMPORTS,
    relative_file_imports=True,
)

# ---------------------------------------------------------------------------
# JVM / .NET / Go / Rust
# ---------------------------------------------------------------------------

JAVA = _spec(
    name="java",
    extensions=(".java",),
    class_types={
        "class_declaration",
        "interface_declaration",
        "enum_declaration",
        "record_declaration",
    },
    function_types={"method_declaration", "constructor_declaration"},
    call_types={"method_invocation", "object_creation_expression"},
    import_types={"import_declaration"},
    namespace_types={"package_declaration"},
)

KOTLIN = _spec(
    name="kotlin",
    extensions=(".kt", ".kts"),
    class_types={"class_declaration", "object_declaration"},
    function_types={"function_declaration"},
    call_types={"call_expression"},
    import_types={"import_header"},
    namespace_types={"package_header"},
)

CSHARP = _spec(
    name="csharp",
    extensions=(".cs",),
    class_types={
        "class_declaration",
        "interface_declaration",
        "struct_declaration",
        "record_declaration",
        "enum_declaration",
    },
    function_types={"method_declaration", "constructor_declaration"},
    call_types={"invocation_expression", "object_creation_expression"},
    import_types={"using_directive"},
    namespace_types={"namespace_declaration", "file_scoped_namespace_declaration"},
)

GO = _spec(
    name="go",
    extensions=(".go",),
    class_types={"type_declaration"},
    function_types={"function_declaration", "method_declaration"},
    call_types={"call_expression"},
    import_types={"import_declaration"},
    namespace_types={"package_clause"},
)

RUST = _spec(
    name="rust",
    extensions=(".rs",),
    class_types={"struct_item", "enum_item", "trait_item", "impl_item"},
    function_types={"function_item"},
    call_types={"call_expression", "macro_invocation"},
    import_types={"use_declaration"},
    namespace_types={"mod_item"},
)

SCALA = _spec(
    name="scala",
    extensions=(".scala", ".sc"),
    class_types={"class_definition", "object_definition", "trait_definition"},
    function_types={"function_definition"},
    call_types={"call_expression"},
    import_types={"import_declaration"},
    namespace_types={"package_clause"},
)

SWIFT = _spec(
    name="swift",
    extensions=(".swift",),
    class_types={"class_declaration", "protocol_declaration"},
    function_types={"function_declaration", "init_declaration"},
    call_types={"call_expression"},
    import_types={"import_declaration"},
)

# ---------------------------------------------------------------------------
# C family - header/impl split makes call resolution unreliable, but
# definitions are still worth having.
# ---------------------------------------------------------------------------

C = _spec(
    name="c",
    extensions=(".c", ".h"),
    class_types={"struct_specifier", "union_specifier", "enum_specifier"},
    function_types={"function_definition"},
    call_types={"call_expression"},
    import_types={"preproc_include"},
)

CPP = _spec(
    name="cpp",
    extensions=(".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"),
    class_types={"class_specifier", "struct_specifier", "union_specifier"},
    function_types={"function_definition"},
    call_types={"call_expression"},
    import_types={"preproc_include"},
    namespace_types={"namespace_definition"},
)

# ---------------------------------------------------------------------------
# Dynamic languages
# ---------------------------------------------------------------------------

RUBY = _spec(
    name="ruby",
    extensions=(".rb", ".rake"),
    class_types={"class", "singleton_class"},
    function_types={"method", "singleton_method"},
    # Ruby's `call` node covers bare identifiers that may be locals or
    # attribute reads, not just method calls, so it over-fires.
    call_types={"call"},
    import_types={"call"},
    namespace_types={"module"},
)

PHP = _spec(
    name="php",
    extensions=(".php",),
    class_types={"class_declaration", "interface_declaration", "trait_declaration"},
    function_types={"function_definition", "method_declaration"},
    call_types={
        "function_call_expression",
        "member_call_expression",
        "scoped_call_expression",
        "object_creation_expression",
    },
    import_types={"namespace_use_declaration"},
    namespace_types={"namespace_definition"},
)

LUA = _spec(
    name="lua",
    extensions=(".lua",),
    function_types={"function_declaration", "function_definition"},
    call_types={"function_call"},
)

# ---------------------------------------------------------------------------
# Definitions-only: grammars where naming call sites reliably is not
# worth the false-edge risk.
# ---------------------------------------------------------------------------

BASH = _spec(
    name="bash",
    extensions=(".sh", ".bash"),
    function_types={"function_definition"},
    calls_supported=False,
)

SQL = _spec(
    name="sql",
    extensions=(".sql",),
    function_types={"create_function_statement"},
    calls_supported=False,
)


ALL_SPECS = (
    JAVASCRIPT,
    TYPESCRIPT,
    TSX,
    JAVA,
    KOTLIN,
    CSHARP,
    GO,
    RUST,
    SCALA,
    SWIFT,
    C,
    CPP,
    RUBY,
    PHP,
    LUA,
    BASH,
    SQL,
)


#: extension -> LanguageSpec. Python is deliberately absent: it is handled
#: by PythonAstService, whose stdlib-ast resolver is far more accurate than
#: anything generic.
SPEC_BY_EXTENSION = {
    extension: spec for spec in ALL_SPECS for extension in spec.extensions
}

#: Everything the ingester will extract from an archive, Python included.
PYTHON_EXTENSIONS = (".py", ".pyi")

SUPPORTED_EXTENSIONS = frozenset(SPEC_BY_EXTENSION) | frozenset(PYTHON_EXTENSIONS)


def spec_for(extension: str) -> LanguageSpec | None:
    return SPEC_BY_EXTENSION.get(extension.lower())


def is_python(extension: str) -> bool:
    return extension.lower() in PYTHON_EXTENSIONS


def is_supported(extension: str) -> bool:
    return extension.lower() in SUPPORTED_EXTENSIONS
