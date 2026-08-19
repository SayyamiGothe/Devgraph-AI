from fastapi import HTTPException, UploadFile
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.document import Document
from app.repositories.document_chunk_repository import DocumentChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.project_repository import ProjectRepository
from uuid import uuid4

from app.services.document_processing_service import DocumentProcessingService

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


class DocumentService:

    def __init__(self, db: Session):
        self.document_repository = DocumentRepository(db)
        self.project_repository = ProjectRepository(db)
        self.chunk_repository = DocumentChunkRepository(db)

        self.processing_service = DocumentProcessingService()

    def create_document(
        self,
        name: str,
        file: UploadFile,
        project_id: int,
        organisation_id: int,
    ):

        # check project
        project = self.project_repository.get_by_id(project_id)

        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project not found",
            )

        # check organisation
        if project.workspaces.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this project",
            )

        # 3. Validate the file type BEFORE writing anything.
        #
        # This path only understands PDFs (PyPDFLoader is unconditional).
        # Previously any extension was accepted, the row was committed,
        # and PyPDFLoader then raised - leaving an orphan Document with
        # zero chunks plus the file on disk.
        extension = Path(file.filename or "").suffix.lower()

        if extension == ".zip":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Zip archives are code repositories, not documents. "
                    "Upload them to POST /repositories/upload instead."
                ),
            )

        if extension != ".pdf":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unsupported file type '{extension or 'unknown'}'. "
                    "Only .pdf files are supported."
                ),
            )

        filename = f"{uuid4()}{extension}"

        # craete complete file path   uploads/8f7c4a21.pdf
        file_path = UPLOAD_DIR / filename

        # Stream to disk rather than reading the whole upload into RAM.
        with open(file_path, "wb") as buffer:

            while True:
                block = file.file.read(1024 * 1024)

                if not block:
                    break

                buffer.write(block)

        # A wrong extension is cheap to fake, so check the magic bytes.
        with open(file_path, "rb") as probe:
            magic = probe.read(5)

        if magic != b"%PDF-":
            file_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=400,
                detail="File is not a valid PDF (missing %PDF- header)",
            )

        # 5. Create document record
        document = Document(
            name=name,
            file_path=str(file_path),
            project_id=project_id,
            source_type="pdf",
        )

        document = self.document_repository.create(document)

        # 6. Process. If this fails, roll back the row and the file so a
        # failed upload leaves nothing behind.
        try:
            chunks, embeddings = self.processing_service.process_document(
                str(file_path)
            )

            self.chunk_repository.create_chunks(
                document_id=document.id,
                chunks=chunks,
                embeddings=embeddings,
            )

        except HTTPException:
            raise

        except Exception as exc:
            self.document_repository.delete(document)
            file_path.unlink(missing_ok=True)

            raise HTTPException(
                status_code=400,
                detail=f"Could not read the PDF: {exc}",
            )

        return document

    def get_document(
        self,
        document_id: int,
        organisation_id: int,
    ):
        document = self.document_repository.get_by_id(document_id)

        if not document:
            raise HTTPException(
                status_code=404,
                detail="Document not found",
            )

        if document.project.workspaces.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this document",
            )

        return document

    def get_documents(
        self,
        project_id: int,
        organisation_id: int,
    ):
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

        return self.document_repository.get_by_project(project_id)

    def delete_document(
        self,
        document_id: int,
        organisation_id: int,
    ):
        document = self.get_document(
            document_id=document_id,
            organisation_id=organisation_id,
        )

        # Remove the file too, or uploads/ grows forever.
        # Code documents share one zip per repository, so only the
        # repository delete removes those.
        if document.source_type != "code" and document.file_path:
            Path(document.file_path).unlink(missing_ok=True)

        self.document_repository.delete(document)

        return {"message": "Document deleted successfully"}

    def update_document(
        self,
        document_id: int,
        name: str | None,
        file_path: str | None,
        organisation_id: int,
    ):
        document = self.document_repository.get_by_id(document_id)

        if not document:
            raise HTTPException(
                status_code=404,
                detail="Document not found",
            )

        if document.project.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this document",
            )

        if name is not None:
            document.name = name

        if file_path is not None:
            document.file_path = file_path

        return self.document_repository.update(document)
