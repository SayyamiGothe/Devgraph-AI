import logging
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.code_repository import CodeRepository
from app.models.document import Document
from app.repositories.code_graph_repository import CodeGraphRepository
from app.repositories.code_repo_repository import CodeRepoRepository
from app.repositories.document_chunk_repository import DocumentChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.project_repository import ProjectRepository
from app.services.archive_service import ArchiveService
from app.services.document_processing_service import DocumentProcessingService
from app.services.python_ast_service import (
    CHUNK_MAX_CHARS,
    PythonAstService,
    SymbolResolver,
    build_chunk_text,
    build_module_chunk,
)

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("uploads")
EMBED_BATCH = 64


class CodeGraphService:
    """
    Ties the two stores together.

    Neo4j gets the relationships; Postgres gets the embedded chunks.
    `code_fqn` on DocumentChunk is the join key between them.
    """

    def __init__(self, db: Session):
        self.db = db

        self.project_repository = ProjectRepository(db)
        self.repo_repository = CodeRepoRepository(db)
        self.document_repository = DocumentRepository(db)
        self.chunk_repository = DocumentChunkRepository(db)
        self.graph_repository = CodeGraphRepository()

        self.archive_service = ArchiveService()
        self.ast_service = PythonAstService()
        self.processing_service = DocumentProcessingService()

    # ------------------------------------------------------------------
    # ingest
    # ------------------------------------------------------------------

    def ingest_zip(
        self,
        name: str,
        file,
        project_id: int,
        organisation_id: int,
    ):

        # 1. authorize - mirrors document_service.py:44
        project = self.project_repository.get_by_id(project_id)

        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project not found",
            )

        # NOT project.organisation_id: that is a Python @property and
        # compiles to WHERE false if it ever reaches a SQL filter.
        if project.workspaces.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this project",
            )

        # 2. replace any previous ingest of the same repo name, or
        #    deleted functions linger in the graph forever and the LLM
        #    will describe code that no longer exists
        existing = self.repo_repository.get_by_name(project_id, name)

        if existing:
            logger.info("Replacing existing repository %s", existing.id)
            self.graph_repository.delete_repository(existing.id)
            self.repo_repository.delete(existing)

        # 3. create the row FIRST - node_key needs the primary key
        UPLOAD_DIR.mkdir(exist_ok=True)
        zip_path = UPLOAD_DIR / f"{uuid4()}.zip"

        repository = self.repo_repository.create(
            CodeRepository(
                name=name,
                project_id=project_id,
                zip_path=str(zip_path),
                status="processing",
            )
        )

        temp_dir = None

        try:
            temp_dir, repo_root, py_files = self.archive_service.extract(file)

            shutil.copy(temp_dir / "upload.zip", zip_path)

            # 4. parse + resolve
            modules, skipped = self.ast_service.parse_repository(
                py_files,
                repo_root,
            )

            resolver = SymbolResolver(modules)
            edges = resolver.build_edges(modules)
            all_nodes = [node for m in modules for node in m.nodes]

            stats = resolver.stats()

            logger.info(
                "Parsed %s modules (%s skipped): %s nodes, %s edges, "
                "call resolution %.1f%%",
                len(modules),
                skipped,
                len(all_nodes),
                len(edges),
                stats["resolution_rate"] * 100,
            )

            # 5. graph
            node_count = self.graph_repository.upsert_nodes(
                repository.id,
                all_nodes,
            )

            edge_count = self.graph_repository.upsert_edges(
                repository.id,
                edges,
            )

            # 6. retrieval chunks
            chunk_count = self._index_modules(
                repository,
                project_id,
                modules,
            )

            logger.info("Indexed %s chunks", chunk_count)

            repository.status = "ready"
            repository.file_count = len(modules)
            repository.skipped_count = skipped
            repository.node_count = node_count
            repository.edge_count = edge_count

            return self.repo_repository.update(repository)

        except Exception as exc:
            logger.exception(
                "Ingest failed for repository %s",
                repository.id,
            )

            repository.status = "failed"
            repository.error = str(exc)[:2000]
            self.repo_repository.update(repository)

            raise

        finally:
            if temp_dir:
                shutil.rmtree(temp_dir, ignore_errors=True)

    # ------------------------------------------------------------------
    # indexing for retrieval
    # ------------------------------------------------------------------

    def _index_modules(self, repository, project_id, modules) -> int:
        """One Document per source file, one chunk per definition."""
        splitter = self.processing_service.get_splitter()

        total = 0

        for module in modules:

            source_lines = module.source.splitlines()

            document = self.document_repository.create(
                Document(
                    name=module.file_path,
                    file_path=module.file_path,
                    project_id=project_id,
                    source_type="code",
                    code_repository_id=repository.id,
                )
            )

            pending = []

            module_text = build_module_chunk(module)

            if module_text:
                pending.append(
                    (
                        module_text,
                        module.module_fqn,
                        "module",
                        1,
                        len(source_lines),
                    )
                )

            for node in module.nodes:

                if node.kind == "module":
                    continue

                text = build_chunk_text(node, source_lines)

                if len(text) <= CHUNK_MAX_CHARS:
                    pending.append(
                        (
                            text,
                            node.fqn,
                            node.kind,
                            node.start_line,
                            node.end_line,
                        )
                    )
                else:
                    for piece in splitter.split_text(text):
                        pending.append(
                            (
                                piece,
                                node.fqn,
                                node.kind,
                                node.start_line,
                                node.end_line,
                            )
                        )

            total += self._embed_and_store(document.id, pending)

        return total

    def _embed_and_store(self, document_id: int, pending) -> int:
        records = []

        # Batched: one embed_documents call per chunk would be roughly
        # an order of magnitude slower on a few-hundred-function repo.
        for start in range(0, len(pending), EMBED_BATCH):

            batch = pending[start:start + EMBED_BATCH]
            texts = [item[0] for item in batch]

            embeddings = self.processing_service.embed_texts(texts)

            for offset, (item, embedding) in enumerate(zip(batch, embeddings)):

                text, fqn, kind, start_line, end_line = item

                records.append(
                    {
                        "chunk_text": text,
                        "chunk_index": start + offset,
                        "embedding": embedding,
                        "code_fqn": fqn,
                        "code_kind": kind,
                        "start_line": start_line,
                        "end_line": end_line,
                    }
                )

        if not records:
            return 0

        return self.chunk_repository.create_code_chunks(document_id, records)

    # ------------------------------------------------------------------
    # read / delete
    # ------------------------------------------------------------------

    def get_repository(self, repository_id: int, organisation_id: int):
        repository = self.repo_repository.get_by_id(repository_id)

        if not repository:
            raise HTTPException(
                status_code=404,
                detail="Repository not found",
            )

        if repository.project.workspaces.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this repository",
            )

        return repository

    def get_repositories(self, project_id: int, organisation_id: int):
        project = self.project_repository.get_by_id(project_id)

        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project not found",
            )

        if project.workspaces.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this project",
            )

        return self.repo_repository.get_by_project(project_id)

    def delete_repository(self, repository_id: int, organisation_id: int):
        repository = self.get_repository(repository_id, organisation_id)

        self.graph_repository.delete_repository(repository.id)

        zip_path = Path(repository.zip_path)

        if zip_path.exists():
            zip_path.unlink(missing_ok=True)

        # Cascades to Documents and their DocumentChunks.
        self.repo_repository.delete(repository)

        return {"message": "Repository deleted successfully"}
