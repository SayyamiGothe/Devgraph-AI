from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user

from app.database.session import get_db
from app.models.user import User
from app.services.document_service import DocumentService
from app.schemas.document import (
    DocumentCreate,
    DocumentResponse,
    DocumentUpdate,
)
from app.repositories.project_repository import ProjectRepository

router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


@router.post(
    "",
    response_model=DocumentResponse,
)
def create_document(
    name: str = Form(...),
    project_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DocumentService(db)

    return service.create_document(
        name=name,
        project_id=project_id,
        file=file,
        organisation_id=current_user.organisation_id,
    )


@router.get("/{document_id}")
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DocumentService(db)

    return service.get_document(
        document_id=document_id,
        organisation_id=current_user.organisation_id,
    )


@router.get("")
def get_documents(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DocumentService(db)

    return service.get_documents(
        project_id=project_id,
        organisation_id=current_user.organisation_id,
    )


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DocumentService(db)

    return service.delete_document(
        document_id=document_id,
        organisation_id=current_user.organisation_id,
    )


@router.put("/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: int,
    request: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DocumentService(db)

    return service.update_document(
        document_id=document_id,
        name=request.name,
        file_path=request.file_path,
        organisation_id=current_user.organisation_id,
    )

@router.post("/upload")
def upload_document(
    project_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # ------------------------------------------
    # 1. Verify project belongs to organization
    # ------------------------------------------

    project_repository = ProjectRepository(db)

    project = project_repository.get_for_organization(
        project_id=project_id,
        organisation_id=current_user.organisation_id,
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    # ------------------------------------------
    # 2. Save/process document
    # ------------------------------------------

    service = DocumentService(db)

    document = service.create_document(
        project_id=project_id,
        file=file,
    )

    # ------------------------------------------
    # 3. Return
    # ------------------------------------------

    return document