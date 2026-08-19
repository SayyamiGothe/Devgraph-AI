"""
Archive extraction: security guards and repo-root detection.

Both matter more than they look. A zip-slip or symlink entry writes
attacker-controlled files onto the host; a wrong repo root silently
prefixes or truncates every module fqn, which breaks call resolution
without raising anything.
"""

import zipfile

import pytest
from fastapi import HTTPException

from app.services.archive_service import ArchiveService


class FakeUpload:
    def __init__(self, path):
        self.filename = path.name
        self.file = open(path, "rb")

    def close(self):
        self.file.close()


def make_zip(tmp_path, name, entries: dict):
    path = tmp_path / name
    with zipfile.ZipFile(path, "w") as archive:
        for member, content in entries.items():
            archive.writestr(member, content)
    return path


def extract(tmp_path, name, entries: dict):
    """Returns (repo_root_name, sorted relative source paths)."""
    upload = FakeUpload(make_zip(tmp_path, name, entries))
    temp_dir = None

    try:
        temp_dir, repo_root, source_files = ArchiveService().extract(upload)
        rels = sorted(
            str(p.relative_to(repo_root)).replace("\\", "/") for p in source_files
        )
        return repo_root.name, rels
    finally:
        upload.close()
        if temp_dir:
            import shutil

            shutil.rmtree(temp_dir, ignore_errors=True)


# ----------------------------------------------------------------------
# security guards
# ----------------------------------------------------------------------


def test_zip_slip_is_rejected(tmp_path):
    with pytest.raises(HTTPException) as exc:
        extract(tmp_path, "slip.zip", {
            "../../evil.py": "print('escaped')",
            "app/main.py": "print('ok')",
        })

    assert exc.value.status_code == 400
    assert "unsafe path" in exc.value.detail


def test_symlink_entry_is_dropped(tmp_path):
    """A symlink named like source would otherwise be read and embedded."""
    path = tmp_path / "link.zip"

    with zipfile.ZipFile(path, "w") as archive:
        info = zipfile.ZipInfo("app/config.py")
        info.external_attr = 0o120777 << 16
        archive.writestr(info, "/etc/passwd")
        archive.writestr("app/main.py", "print('ok')")
        archive.writestr("README.md", "# x")

    upload = FakeUpload(path)
    try:
        _, repo_root, source_files = ArchiveService().extract(upload)
        names = {p.name for p in source_files}
        assert "config.py" not in names
        assert "main.py" in names
    finally:
        upload.close()


def test_non_zip_is_rejected(tmp_path):
    path = tmp_path / "notes.pdf"
    path.write_bytes(b"%PDF-1.4")

    upload = FakeUpload(path)
    try:
        with pytest.raises(HTTPException) as exc:
            ArchiveService().extract(upload)
        assert exc.value.status_code == 400
    finally:
        upload.close()


def test_archive_with_no_source_reports_what_it_found(tmp_path):
    with pytest.raises(HTTPException) as exc:
        extract(tmp_path, "assets.zip", {
            "img/a.png": "x",
            "img/b.png": "x",
            "docs/readme.txt": "x",
        })

    assert exc.value.status_code == 400
    # The message must name the actual contents, or the user has no idea why.
    assert ".png" in exc.value.detail
    assert "Supported extensions" in exc.value.detail


def test_junk_directories_are_skipped(tmp_path):
    _, rels = extract(tmp_path, "junk.zip", {
        "app/main.py": "print('ok')",
        "app/__init__.py": "",
        ".venv/lib/site-packages/numpy/core.py": "x = 1",
        "node_modules/react/index.js": "module.exports = 1",
        "app/__pycache__/main.cpython-312.pyc": "junk",
        "dist/bundle.js": "x",
        "README.md": "# x",
    })

    assert not any(".venv" in r for r in rels)
    assert not any("node_modules" in r for r in rels)
    assert not any("__pycache__" in r for r in rels)
    assert not any("dist/" in r for r in rels)
    assert "app/main.py" in rels


# ----------------------------------------------------------------------
# repo-root detection
# ----------------------------------------------------------------------


def test_github_wrapper_is_stripped(tmp_path):
    """repo-main/ holds markers, so it is a wrapper and must be stripped."""
    root, rels = extract(tmp_path, "gh.zip", {
        "myrepo-main/pyproject.toml": "[project]\nname='x'",
        "myrepo-main/README.md": "# x",
        "myrepo-main/app/main.py": "print('ok')",
        "myrepo-main/app/services/x.py": "def foo(): pass",
    })

    assert root == "myrepo-main"
    assert rels == ["app/main.py", "app/services/x.py"]


def test_passthrough_chain_is_stripped(tmp_path):
    """
    outer/ holding nothing but inner/ carries no information.

    This is the SEIVE-WEB shape: without this, every fqn is prefixed
    with the wrapper name and no import resolves.
    """
    root, rels = extract(tmp_path, "nested.zip", {
        "OUTER/design/README.md": "# x",
        "OUTER/design/js/app.js": "export function boot() {}",
        "OUTER/design/src/index.ts": "export const x = 1",
    })

    assert root == "design"
    assert rels == ["js/app.js", "src/index.ts"]


def test_source_directory_is_not_treated_as_a_wrapper(tmp_path):
    """
    A repo whose only top-level entry is `app/` containing source must
    KEEP the app. prefix, or `from app.x import y` stops resolving.
    """
    root, rels = extract(tmp_path, "appdir.zip", {
        "app/main.py": "print('ok')",
        "app/services/x.py": "def foo(): pass",
    })

    assert root == "src"
    assert rels == ["app/main.py", "app/services/x.py"]


def test_package_directory_is_never_stripped(tmp_path):
    """__init__.py means it is a package, and its name is part of every fqn."""
    root, rels = extract(tmp_path, "pkg.zip", {
        "mypackage/__init__.py": "",
        "mypackage/core.py": "def bar(): pass",
    })

    assert root == "src"
    assert rels == ["mypackage/__init__.py", "mypackage/core.py"]


def test_flat_archive_needs_no_stripping(tmp_path):
    root, rels = extract(tmp_path, "flat.zip", {
        "main.py": "print('ok')",
        "util.py": "def helper(): pass",
    })

    assert root == "src"
    assert rels == ["main.py", "util.py"]


# ----------------------------------------------------------------------
# multi-language pickup
# ----------------------------------------------------------------------


def test_multiple_languages_are_all_kept(tmp_path):
    _, rels = extract(tmp_path, "poly.zip", {
        "README.md": "# x",
        "api/main.py": "def go(): pass",
        "web/app.tsx": "export function App() { return null }",
        "web/util.ts": "export const x = 1",
        "svc/Service.java": "public class Service {}",
        "cmd/main.go": "package main",
        "lib/service.rb": "class Service\nend",
        "core/util.rs": "pub fn helper() {}",
        "notes.txt": "ignored",
        "logo.png": "ignored",
    })

    assert "api/main.py" in rels
    assert "web/app.tsx" in rels
    assert "svc/Service.java" in rels
    assert "cmd/main.go" in rels
    assert "core/util.rs" in rels
    assert not any(r.endswith(".txt") for r in rels)
    assert not any(r.endswith(".png") for r in rels)
