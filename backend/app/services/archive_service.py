import logging
import shutil
import tempfile
import zipfile
from collections import Counter
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.services.language_config import (
    SUPPORTED_EXTENSIONS,
    is_supported,
)

logger = logging.getLogger(__name__)


# Directory names that never contain first-party source worth graphing.
# A single .venv holds 30k+ files, and node_modules is worse.
SKIP_DIR_NAMES = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "env",
    ".env",
    "__pycache__",
    "site-packages",
    "node_modules",
    "bower_components",
    "vendor",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".eggs",
    ".tox",
    ".nox",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".gradle",
    "target",
    ".idea",
    ".vscode",
}


# Files that mark the ROOT of a project rather than a package.
# Kept during extraction purely as a signal for _find_repo_root.
ROOT_MARKERS = {
    # python
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "requirements.txt",
    "tox.ini",
    # javascript / typescript
    "package.json",
    "tsconfig.json",
    "pnpm-workspace.yaml",
    # other ecosystems
    "go.mod",
    "Cargo.toml",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "composer.json",
    "Gemfile",
    "CMakeLists.txt",
    # generic
    "Makefile",
    "Dockerfile",
    ".gitignore",
    "README.md",
    "README.rst",
    "README",
    "LICENSE",
}


class ArchiveService:
    """
    Extracts an uploaded repository zip into a temp directory.

    The caller owns the returned temp directory and MUST remove it
    in a finally block.
    """

    def __init__(self):

        self.max_zip_bytes = settings.MAX_ZIP_SIZE_MB * 1024 * 1024

        # Compression ratio guard: a legitimate source zip is ~4-6x.
        self.max_uncompressed_bytes = self.max_zip_bytes * 20

        self.max_files = settings.MAX_REPO_FILES

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _is_symlink(info: zipfile.ZipInfo) -> bool:
        """
        Unix file mode lives in the high 16 bits of external_attr.
        0o120000 is S_IFLNK.

        Without this check an archive can ship a symlink named
        config.py pointing at /etc/passwd, which we would then read
        and embed into the database.
        """
        return (info.external_attr >> 16) & 0o170000 == 0o120000

    @staticmethod
    def _is_within(base: Path, target: Path) -> bool:
        """Zip-slip guard: reject any member that resolves outside base."""
        try:
            target.resolve().relative_to(base.resolve())
            return True
        except ValueError:
            return False

    def _should_keep(self, name: str) -> bool:

        parts = Path(name).parts

        for part in parts:
            if part in SKIP_DIR_NAMES or part.endswith(".egg-info"):
                return False

        suffix = Path(name).suffix.lower()

        return is_supported(suffix) or Path(name).name in ROOT_MARKERS

    def _find_repo_root(self, extract_root: Path) -> Path:
        """
        Strip wrapper directories so module fqns start at the real root.

        Three cases have to be told apart, and getting it wrong silently
        wrecks call resolution rather than raising:

          1. `repo-main/` from a GitHub zip, holding project markers.
             Descend, or every fqn gains a junk `repo-main.` prefix and
             no absolute import resolves.

          2. `outer/inner/...` where `outer` holds nothing but `inner`.
             A passthrough directory carries no information, so keep
             descending. Real archives nest two or three deep like this.

          3. `app/` containing actual source, and nothing else at the
             top. This is NOT a wrapper: descending would DROP the
             `app.` prefix that every `from app.x import y` depends on.

        A package (`__init__.py`) always stops the descent.
        """
        current = extract_root

        # Bounded: a pathological archive should not spin here.
        for _ in range(6):
            entries = list(current.iterdir())

            if len(entries) != 1 or not entries[0].is_dir():
                break

            candidate = entries[0]

            if (candidate / "__init__.py").exists():
                break

            children = list(candidate.iterdir())

            has_marker = any(
                (candidate / marker).exists() for marker in ROOT_MARKERS
            )
            is_passthrough = len(children) == 1 and children[0].is_dir()

            if not (has_marker or is_passthrough):
                # Case 3: a meaningful namespace directory. Keep it.
                logger.info(
                    "Treating %r as a source directory, not a wrapper; "
                    "fqns will start with it.",
                    candidate.name,
                )
                break

            current = candidate

        if current != extract_root:
            logger.info("Repo root resolved to %r", current.name)

        return current

    # ------------------------------------------------------------------
    # streaming upload to disk
    # ------------------------------------------------------------------

    def _save_upload(self, file: UploadFile, dest: Path) -> int:
        """
        Stream to disk in 1 MB chunks so an oversized upload is
        rejected mid-stream instead of being fully buffered in RAM.
        """
        size = 0

        try:
            with open(dest, "wb") as buffer:

                while True:

                    chunk = file.file.read(1024 * 1024)

                    if not chunk:
                        break

                    size += len(chunk)

                    if size > self.max_zip_bytes:
                        raise HTTPException(
                            status_code=413,
                            detail=(
                                f"Zip exceeds the "
                                f"{settings.MAX_ZIP_SIZE_MB} MB limit"
                            ),
                        )

                    buffer.write(chunk)

        except HTTPException:
            dest.unlink(missing_ok=True)
            raise

        return size

    # ------------------------------------------------------------------
    # main entry point
    # ------------------------------------------------------------------

    def extract(self, file: UploadFile):
        """
        Returns (temp_dir, repo_root, source_files).

        temp_dir     -> caller must shutil.rmtree this
        repo_root    -> base for computing module fqns
        source_files -> absolute paths of every kept source file
        """

        if not (file.filename or "").lower().endswith(".zip"):
            raise HTTPException(
                status_code=400,
                detail="Only .zip archives are supported",
            )

        temp_dir = Path(tempfile.mkdtemp(prefix="devgraph_repo_"))

        zip_path = temp_dir / "upload.zip"

        extract_root = temp_dir / "src"
        extract_root.mkdir()

        try:
            self._save_upload(file, zip_path)

            if not zipfile.is_zipfile(zip_path):
                raise HTTPException(
                    status_code=400,
                    detail="File is not a valid zip archive",
                )

            with zipfile.ZipFile(zip_path) as archive:

                members = [m for m in archive.infolist() if not m.is_dir()]

                # --- zip bomb guard: check declared size BEFORE writing ---
                total_uncompressed = sum(m.file_size for m in members)

                if total_uncompressed > self.max_uncompressed_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail="Archive expands to an unreasonable size",
                    )

                kept = []

                for member in members:

                    if self._is_symlink(member):
                        logger.info(
                            "Skipping symlink %s",
                            member.filename,
                        )
                        continue

                    if not self._should_keep(member.filename):
                        continue

                    # --- zip slip guard ---
                    target = extract_root / member.filename

                    if not self._is_within(extract_root, target):
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                "Archive contains an unsafe path: "
                                f"{member.filename}"
                            ),
                        )

                    kept.append(member)

                # Markers are kept only as a root-detection signal,
                # so the limits below count real source files.
                source_count = sum(
                    1
                    for m in kept
                    if Path(m.filename).suffix.lower() in SUPPORTED_EXTENSIONS
                )

                if not source_count:
                    # Say what WAS in there: "no source files found" alone
                    # gives no clue why a given archive was rejected.
                    counts = Counter(
                        Path(m.filename).suffix.lower() or "(no extension)"
                        for m in members
                    )
                    top = ", ".join(
                        f"{count} {ext}" for ext, count in counts.most_common(4)
                    )
                    supported = " ".join(sorted(SUPPORTED_EXTENSIONS))

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "No supported source files found in the archive. "
                            f"It contains {top}. Supported extensions: "
                            f"{supported}"
                        ),
                    )

                if source_count > self.max_files:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            f"Archive has {source_count} source files, "
                            f"limit is {self.max_files}"
                        ),
                    )

                for member in kept:
                    archive.extract(member, extract_root)

            repo_root = self._find_repo_root(extract_root)

            source_files = sorted(
                p
                for p in repo_root.rglob("*")
                if p.is_file() and is_supported(p.suffix)
            )

            logger.info(
                "Extracted %s source files, repo root %s",
                len(source_files),
                repo_root.name,
            )

            return temp_dir, repo_root, source_files

        except Exception:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise
