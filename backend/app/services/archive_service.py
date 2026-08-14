import logging
import shutil
import tempfile
import zipfile
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)


# Directory names that never contain first-party source worth graphing.
# A single .venv holds 30k+ files and would drown the real code.
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
    "dist",
    "build",
    ".eggs",
    ".tox",
    ".nox",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".idea",
    ".vscode",
}


# Files that mark the ROOT of a project rather than a package.
# Kept during extraction purely as a signal for _find_repo_root.
ROOT_MARKERS = {
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "requirements.txt",
    "tox.ini",
    "Makefile",
    ".gitignore",
    "README.md",
    "README.rst",
    "README",
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

        return name.endswith(".py") or Path(name).name in ROOT_MARKERS

    def _find_repo_root(self, extract_root: Path) -> Path:
        """
        GitHub zips wrap everything in a single 'repo-main/' directory.
        Descend into it, or every module fqn gains a junk prefix and
        no absolute import will ever resolve.

        But do NOT descend into a directory that is simply the repo's
        only source package (e.g. a repo containing just 'app/'), or
        every fqn LOSES its root segment and imports break the same way.

        Two signals distinguish them:
          - a package has __init__.py, a wrapper does not
          - a project root has marker files, a package does not
        """
        entries = list(extract_root.iterdir())

        if len(entries) != 1 or not entries[0].is_dir():
            return extract_root

        candidate = entries[0]

        if (candidate / "__init__.py").exists():
            return extract_root

        has_marker = any(
            (candidate / marker).exists() for marker in ROOT_MARKERS
        )

        if has_marker:
            return candidate

        logger.warning(
            "Single top-level directory %r has no package or project "
            "markers; treating the archive root as the repo root. "
            "Module paths may be prefixed with %r.",
            candidate.name,
            candidate.name,
        )

        return extract_root

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
        Returns (temp_dir, repo_root, py_files).

        temp_dir  -> caller must shutil.rmtree this
        repo_root -> base for computing module fqns
        py_files  -> absolute paths of every kept .py file
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
                python_count = sum(
                    1 for m in kept if m.filename.endswith(".py")
                )

                if not python_count:
                    raise HTTPException(
                        status_code=400,
                        detail="No Python files found in the archive",
                    )

                if python_count > self.max_files:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            f"Archive has {python_count} Python files, "
                            f"limit is {self.max_files}"
                        ),
                    )

                for member in kept:
                    archive.extract(member, extract_root)

            repo_root = self._find_repo_root(extract_root)

            py_files = sorted(repo_root.rglob("*.py"))

            logger.info(
                "Extracted %s Python files, repo root %s",
                len(py_files),
                repo_root.name,
            )

            return temp_dir, repo_root, py_files

        except Exception:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise
