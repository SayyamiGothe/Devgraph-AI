"""
Multi-language extraction via tree-sitter.

Definitions and nesting must be right for every configured language.
CALLS edges are best-effort per language, so they are asserted only where
the resolver can be trusted.
"""

import textwrap

import pytest

from app.services.language_config import (
    SUPPORTED_EXTENSIONS,
    is_python,
    is_supported,
    spec_for,
)
from app.services.python_ast_service import SymbolResolver
from app.services.treesitter_service import TreeSitterService


def write(tmp_path, files: dict):
    for rel, source in files.items():
        path = tmp_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(textwrap.dedent(source).lstrip("\n"), encoding="utf-8")

    return tmp_path, sorted(p for p in tmp_path.rglob("*") if p.is_file())


def parse(tmp_path, files: dict):
    root, paths = write(tmp_path, files)
    modules, skipped = TreeSitterService().parse_repository(paths, root)
    resolver = SymbolResolver(modules)
    edges = set(resolver.build_edges(modules))
    return resolver, edges, modules, skipped


def names_of(resolver, kind=None):
    return {
        node.name
        for node in resolver.symbols.values()
        if kind is None or node.kind == kind
    }


# ----------------------------------------------------------------------
# registry
# ----------------------------------------------------------------------


def test_python_is_not_routed_to_treesitter():
    """The stdlib ast path is more accurate; it must own .py."""
    assert is_python(".py")
    assert spec_for(".py") is None


@pytest.mark.parametrize(
    "extension",
    [".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rs", ".rb", ".php",
     ".cs", ".c", ".cpp", ".kt", ".swift", ".scala", ".lua", ".sh"],
)
def test_extension_is_registered(extension):
    assert is_supported(extension)
    assert spec_for(extension) is not None


def test_unsupported_extension():
    assert not is_supported(".txt")
    assert not is_supported(".png")
    assert ".py" in SUPPORTED_EXTENSIONS


# ----------------------------------------------------------------------
# per-language definitions
# ----------------------------------------------------------------------


def test_javascript_classes_functions_and_calls(tmp_path):
    resolver, edges, _, skipped = parse(tmp_path, {
        "web/util.js": """
            export function helper() { return 1 }
        """,
        "web/service.js": """
            import { helper } from './util'

            export class Service {
              run() { return helper() }
            }

            export function go() {
              return new Service().run()
            }
        """,
    })

    assert skipped == 0
    assert "Service" in names_of(resolver, "class")
    assert {"helper", "run", "go"} <= names_of(resolver, "function")

    # nesting: run() belongs to Service
    assert "web.service.Service.run" in resolver.symbols

    # cross-file call through a named import
    assert ("web.service.Service.run", "web.util.helper", "CALLS") in edges


def test_typescript_interfaces_and_methods(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "src/shape.ts": """
            export interface Shape { area: number }

            export class Circle {
              radius: number = 1
              area(): number { return this.radius * 2 }
            }
        """,
    })

    assert "Shape" in names_of(resolver, "class")
    assert "src.shape.Circle.area" in resolver.symbols


def test_tsx_component_is_extracted(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "ui/App.tsx": """
            import React from 'react'

            export function App(): JSX.Element {
              return <div>hi</div>
            }
        """,
    })

    assert "ui.App.App" in resolver.symbols


def test_index_file_becomes_the_package(tmp_path):
    """web/util/index.js is the entry for `web.util`, not `web.util.index`."""
    resolver, _, _, _ = parse(tmp_path, {
        "web/util/index.js": """
            export function helper() { return 1 }
        """,
    })

    assert "web.util.helper" in resolver.symbols


def test_java_class_and_method(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "src/Service.java": """
            package com.example;

            public class Service {
                public int run(String x) { return compute(x); }
                private int compute(String x) { return 1; }
            }
        """,
    })

    assert "Service" in names_of(resolver, "class")
    assert "src.Service.Service.run" in resolver.symbols
    assert "src.Service.Service.compute" in resolver.symbols


def test_java_same_class_call(tmp_path):
    _, edges, _, _ = parse(tmp_path, {
        "src/Service.java": """
            package com.example;

            public class Service {
                public int run(String x) { return compute(x); }
                private int compute(String x) { return 1; }
            }
        """,
    })

    assert (
        "src.Service.Service.run",
        "src.Service.Service.compute",
        "CALLS",
    ) in edges


def test_go_functions_and_methods(tmp_path):
    resolver, edges, _, _ = parse(tmp_path, {
        "cmd/main.go": """
            package main

            func helper() int { return 1 }

            func main() { helper() }
        """,
    })

    assert {"helper", "main"} <= names_of(resolver, "function")
    assert ("cmd.main.main", "cmd.main.helper", "CALLS") in edges


def test_rust_struct_impl_and_fn(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "src/service.rs": """
            pub struct Service { n: i32 }

            impl Service {
                pub fn run(&self) -> i32 { helper() }
            }

            pub fn helper() -> i32 { 1 }
        """,
    })

    assert "Service" in names_of(resolver, "class")
    assert "helper" in names_of(resolver, "function")


def test_ruby_module_class_method(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "lib/service.rb": """
            class Service
              def run
                helper
              end
            end
        """,
    })

    assert "Service" in names_of(resolver, "class")
    assert "lib.service.Service.run" in resolver.symbols


def test_csharp_namespace_class_method(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "src/Service.cs": """
            using System;

            namespace App {
              public class Service {
                public int Run(string x) { return Compute(x); }
                private int Compute(string x) { return 1; }
              }
            }
        """,
    })

    assert "Service" in names_of(resolver, "class")
    assert "Run" in names_of(resolver, "function")


def test_php_class_and_method(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "src/Service.php": """
            <?php
            namespace App;

            class Service {
              public function run($x) { return $this->compute($x); }
              private function compute($x) { return 1; }
            }
        """,
    })

    assert "Service" in names_of(resolver, "class")
    assert "run" in names_of(resolver, "function")


def test_c_function_definition(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "src/util.c": """
            #include "util.h"

            int helper(int x) { return x + 1; }

            int run(int x) { return helper(x); }
        """,
    })

    assert {"helper", "run"} <= names_of(resolver, "function")


def test_cpp_class_and_method(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "src/service.cpp": """
            class Service {
            public:
              int run(int x) { return x; }
            };
        """,
    })

    assert "Service" in names_of(resolver, "class")


# ----------------------------------------------------------------------
# cross-cutting behaviour
# ----------------------------------------------------------------------


def test_line_numbers_and_language_recorded(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "web/service.js": """
            // leading comment
            export function first() { return 1 }

            export function second() { return 2 }
        """,
    })

    node = resolver.symbols["web.service.second"]

    assert node.language == "javascript"
    assert node.start_line >= 3
    assert node.end_line >= node.start_line
    assert node.kind == "function"


def test_signature_is_captured(tmp_path):
    resolver, _, _, _ = parse(tmp_path, {
        "web/service.js": """
            export function go(a, b) { return a + b }
        """,
    })

    assert "(a, b)" in resolver.symbols["web.service.go"].signature


def test_defines_edges_across_languages(tmp_path):
    _, edges, _, _ = parse(tmp_path, {
        "web/service.js": """
            export class Service {
              run() { return 1 }
            }
        """,
    })

    assert ("web.service.Service", "web.service.Service.run", "DEFINES") in edges
    assert ("web.service", "web.service.Service", "DEFINES") in edges


def test_broken_syntax_is_skipped_not_fatal(tmp_path):
    """tree-sitter is error-tolerant, so this must still yield the good file."""
    resolver, _, _, _ = parse(tmp_path, {
        "web/good.js": """
            export function fine() { return 1 }
        """,
        "web/bad.js": "export function ((( {{{ \n",
    })

    assert "web.good.fine" in resolver.symbols


def test_ambiguous_cross_file_name_produces_no_edge(tmp_path):
    """Same guard as Python: two candidates means drop the edge."""
    _, edges, _, _ = parse(tmp_path, {
        "a/one.js": """
            export class A { create() { return 1 } }
        """,
        "b/two.js": """
            export class B { create() { return 2 } }
        """,
        "c/three.js": """
            export function go() { return create() }
        """,
    })

    outgoing = [d for s, d, k in edges if k == "CALLS" and s == "c.three.go"]
    assert outgoing == []


def test_polyglot_repo_in_one_pass(tmp_path):
    """One resolver over several languages at once."""
    resolver, _, modules, skipped = parse(tmp_path, {
        "web/app.js": "export function boot() { return 1 }\n",
        "src/Service.java": "public class Service { public int run() { return 1; } }\n",
        "cmd/main.go": "package main\nfunc main() { }\n",
        "lib/service.rb": "class Service\n  def run\n  end\nend\n",
    })

    assert skipped == 0
    assert len(modules) == 4

    languages = {m.language for m in modules}
    assert languages == {"javascript", "java", "go", "ruby"}

    assert "web.app.boot" in resolver.symbols
    assert "cmd.main.main" in resolver.symbols


def test_non_source_files_are_ignored_by_the_parser(tmp_path):
    _, _, modules, skipped = parse(tmp_path, {
        "notes.txt": "hello\n",
        "web/app.js": "export function boot() { return 1 }\n",
    })

    assert len(modules) == 1
    assert skipped == 1
