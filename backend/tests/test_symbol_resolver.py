"""
Tests for the AST parser and symbol resolver.

This is the one place where a subtle bug produces confident WRONG
answers rather than an obvious failure, so the ambiguity and
relative-import cases matter most.
"""

import textwrap

import pytest

from app.services.python_ast_service import (
    PythonAstService,
    SymbolResolver,
    build_chunk_text,
    build_module_chunk,
    module_fqn_from_path,
)


def write(tmp_path, files: dict):
    """files: {"pkg/mod.py": "source"} -> (repo_root, py_files)."""
    for rel, source in files.items():
        path = tmp_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(textwrap.dedent(source), encoding="utf-8")

    return tmp_path, sorted(tmp_path.rglob("*.py"))


def parse(tmp_path, files: dict):
    root, py_files = write(tmp_path, files)
    modules, skipped = PythonAstService().parse_repository(py_files, root)
    resolver = SymbolResolver(modules)
    edges = set(resolver.build_edges(modules))
    return resolver, edges, skipped


# ----------------------------------------------------------------------
# module fqn
# ----------------------------------------------------------------------


@pytest.mark.parametrize(
    "rel,expected_fqn,expected_pkg",
    [
        ("app/services/x.py", "app.services.x", False),
        ("app/services/__init__.py", "app.services", True),
        ("main.py", "main", False),
        ("__init__.py", "", True),
    ],
)
def test_module_fqn_from_path(tmp_path, rel, expected_fqn, expected_pkg):
    path = tmp_path / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("", encoding="utf-8")

    fqn, is_package = module_fqn_from_path(path, tmp_path)

    assert fqn == expected_fqn
    assert is_package is expected_pkg


# ----------------------------------------------------------------------
# nesting and DEFINES
# ----------------------------------------------------------------------


def test_nested_fqns_and_defines(tmp_path):
    resolver, edges, _ = parse(tmp_path, {
        "pkg/__init__.py": "",
        "pkg/mod.py": """
            class Outer:
                def method(self):
                    def inner():
                        pass
                    return inner
        """,
    })

    assert "pkg.mod.Outer" in resolver.symbols
    assert "pkg.mod.Outer.method" in resolver.symbols
    assert "pkg.mod.Outer.method.inner" in resolver.symbols

    assert ("pkg.mod.Outer", "pkg.mod.Outer.method", "DEFINES") in edges
    assert ("pkg.mod", "pkg.mod.Outer", "DEFINES") in edges


def test_async_and_signature_captured(tmp_path):
    resolver, _, _ = parse(tmp_path, {
        "m.py": """
            async def fetch(url: str, timeout: int = 5) -> bytes:
                return b""
        """,
    })

    node = resolver.symbols["m.fetch"]
    assert node.is_async is True
    assert "url: str" in node.signature
    assert "-> bytes" in node.signature


def test_decorators_captured(tmp_path):
    resolver, _, _ = parse(tmp_path, {
        "m.py": """
            import functools

            @functools.cache
            def cached():
                pass
        """,
    })

    assert "functools.cache" in resolver.symbols["m.cached"].decorators


# ----------------------------------------------------------------------
# resolution: the cases that carry the feature
# ----------------------------------------------------------------------


def test_self_method_call(tmp_path):
    _, edges, _ = parse(tmp_path, {
        "m.py": """
            class Service:
                def outer(self):
                    return self.inner()

                def inner(self):
                    pass
        """,
    })

    assert ("m.Service.outer", "m.Service.inner", "CALLS") in edges


def test_self_attribute_type_inference_across_files(tmp_path):
    """self.repo = Repo(); self.repo.find() resolves to Repo.find."""
    _, edges, _ = parse(tmp_path, {
        "repo.py": """
            class Repo:
                def find(self):
                    pass
        """,
        "service.py": """
            from repo import Repo

            class Service:
                def __init__(self):
                    self.repo = Repo()

                def run(self):
                    return self.repo.find()
        """,
    })

    assert ("service.Service.run", "repo.Repo.find", "CALLS") in edges


def test_local_variable_type_inference(tmp_path):
    """
    service = Service(); service.run() must resolve even though the
    calling function shares the callee's name - the exact shape that
    found zero callers before type inference existed.
    """
    _, edges, _ = parse(tmp_path, {
        "service.py": """
            class Service:
                def run(self):
                    pass
        """,
        "router.py": """
            from service import Service

            def run():
                service = Service()
                return service.run()
        """,
    })

    assert ("router.run", "service.Service.run", "CALLS") in edges


def test_aliased_import_resolution(tmp_path):
    _, edges, _ = parse(tmp_path, {
        "deep/__init__.py": "",
        "deep/helpers.py": """
            def helper():
                pass
        """,
        "caller.py": """
            from deep import helpers as h

            def go():
                return h.helper()
        """,
    })

    assert ("caller.go", "deep.helpers.helper", "CALLS") in edges


def test_relative_import_single_dot(tmp_path):
    _, edges, _ = parse(tmp_path, {
        "pkg/__init__.py": "",
        "pkg/util.py": """
            def helper():
                pass
        """,
        "pkg/main.py": """
            from .util import helper

            def go():
                return helper()
        """,
    })

    assert ("pkg.main.go", "pkg.util.helper", "CALLS") in edges
    assert ("pkg.main", "pkg.util", "IMPORTS") in edges


def test_relative_import_double_dot(tmp_path):
    _, edges, _ = parse(tmp_path, {
        "pkg/__init__.py": "",
        "pkg/core.py": """
            def core_fn():
                pass
        """,
        "pkg/sub/__init__.py": "",
        "pkg/sub/leaf.py": """
            from ..core import core_fn

            def go():
                return core_fn()
        """,
    })

    assert ("pkg.sub.leaf.go", "pkg.core.core_fn", "CALLS") in edges


def test_relative_import_from_package_init(tmp_path):
    """An __init__.py's own fqn IS the package, so `from .x` must not
    strip an extra level."""
    _, edges, _ = parse(tmp_path, {
        "pkg/__init__.py": """
            from .util import helper

            def bootstrap():
                return helper()
        """,
        "pkg/util.py": """
            def helper():
                pass
        """,
    })

    assert ("pkg.bootstrap", "pkg.util.helper", "CALLS") in edges


def test_same_module_sibling_call(tmp_path):
    _, edges, _ = parse(tmp_path, {
        "m.py": """
            def a():
                return b()

            def b():
                pass
        """,
    })

    assert ("m.a", "m.b", "CALLS") in edges


def test_inherits_across_files(tmp_path):
    _, edges, _ = parse(tmp_path, {
        "base.py": """
            class Base:
                pass
        """,
        "child.py": """
            from base import Base

            class Child(Base):
                pass
        """,
    })

    assert ("child.Child", "base.Base", "INHERITS") in edges


# ----------------------------------------------------------------------
# precision: no edge beats a wrong edge
# ----------------------------------------------------------------------


def test_ambiguous_bare_name_produces_no_edge(tmp_path):
    """Two `create` definitions mean a bare create() must not pick one."""
    _, edges, _ = parse(tmp_path, {
        "a.py": """
            class A:
                def create(self):
                    pass
        """,
        "b.py": """
            class B:
                def create(self):
                    pass
        """,
        "c.py": """
            def go():
                return create()
        """,
    })

    outgoing = [d for s, d, k in edges if k == "CALLS" and s == "c.go"]
    assert outgoing == []


def test_untyped_receiver_does_not_guess_by_method_name(tmp_path):
    """
    The self.db.refresh() case. An untyped receiver must NOT match an
    unrelated function sharing the method name - that bug fabricated 13
    edges pointing at an auth endpoint.
    """
    _, edges, _ = parse(tmp_path, {
        "endpoints.py": """
            def refresh():
                pass
        """,
        "repo.py": """
            class Repo:
                def __init__(self, db):
                    self.db = db

                def reload(self, obj):
                    return self.db.refresh(obj)
        """,
    })

    assert ("repo.Repo.reload", "endpoints.refresh", "CALLS") not in edges


def test_external_calls_produce_no_edges(tmp_path):
    _, edges, _ = parse(tmp_path, {
        "m.py": """
            import json

            def go(data):
                return len(json.dumps(data))
        """,
    })

    assert [e for e in edges if e[2] == "CALLS"] == []


def test_recursion_is_not_an_edge(tmp_path):
    _, edges, _ = parse(tmp_path, {
        "m.py": """
            def fact(n):
                return 1 if n <= 1 else n * fact(n - 1)
        """,
    })

    assert ("m.fact", "m.fact", "CALLS") not in edges


def test_nested_function_gets_its_own_scope(tmp_path):
    resolver, _, _ = parse(tmp_path, {
        "m.py": """
            class Service:
                def outer(self):
                    def inner():
                        pass
                    return inner

                def helper(self):
                    pass
        """,
    })

    assert "m.Service.outer.inner" in resolver.symbols


def test_duplicate_call_yields_one_edge(tmp_path):
    _, edges, _ = parse(tmp_path, {
        "m.py": """
            def a():
                for _ in range(10):
                    b()
                b()
                b()

            def b():
                pass
        """,
    })

    matches = [e for e in edges if e == ("m.a", "m.b", "CALLS")]
    assert len(matches) == 1


# ----------------------------------------------------------------------
# robustness
# ----------------------------------------------------------------------


def test_syntax_error_is_skipped_not_fatal(tmp_path):
    resolver, _, skipped = parse(tmp_path, {
        "good.py": """
            def fine():
                pass
        """,
        "bad.py": "def broken( :\n",
    })

    assert skipped == 1
    assert "good.fine" in resolver.symbols


def test_resolution_stats_shape(tmp_path):
    resolver, _, _ = parse(tmp_path, {
        "m.py": """
            import json

            def a():
                return b() and json.dumps({})

            def b():
                pass
        """,
    })

    stats = resolver.stats()

    assert stats["calls_total"] >= 2
    assert 0.0 <= stats["resolution_rate"] <= 1.0
    assert "json.dumps" in dict(stats["top_unresolved"])


# ----------------------------------------------------------------------
# chunk building
# ----------------------------------------------------------------------


def test_build_chunk_text_has_header_and_exact_slice(tmp_path):
    root, py_files = write(tmp_path, {
        "m.py": """
            def first():
                pass


            def second():
                return 42
        """,
    })
    modules, _ = PythonAstService().parse_repository(py_files, root)
    module = modules[0]
    lines = module.source.splitlines()

    node = next(n for n in module.nodes if n.name == "second")
    text = build_chunk_text(node, lines)

    assert "# fqn: m.second" in text
    assert "# file: m.py:" in text
    assert "return 42" in text
    assert "def first" not in text


def test_build_module_chunk_stops_at_first_definition(tmp_path):
    root, py_files = write(tmp_path, {
        "m.py": """
            import os

            CONSTANT = 1

            def fn():
                pass
        """,
    })
    modules, _ = PythonAstService().parse_repository(py_files, root)

    text = build_module_chunk(modules[0])

    assert "CONSTANT = 1" in text
    assert "import os" in text
    assert "def fn" not in text


def test_build_module_chunk_returns_none_when_empty(tmp_path):
    root, py_files = write(tmp_path, {"m.py": "def fn():\n    pass\n"})
    modules, _ = PythonAstService().parse_repository(py_files, root)

    assert build_module_chunk(modules[0]) is None
