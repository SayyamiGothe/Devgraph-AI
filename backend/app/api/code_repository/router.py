from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.core.rate_limiter import rag_rate_limiter
from app.core.security import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.repositories.code_graph_repository import CodeGraphRepository
from app.schemas.code_repository import (
    CodeRepositoryResponse,
    GraphNeighboursResponse,
)
from app.services.code_graph_service import CodeGraphService

router = APIRouter(
    prefix="/repositories",
    tags=["Code Repositories"],
)


# --------------------------------------------------
# UPLOAD A REPOSITORY ZIP
# --------------------------------------------------


@router.post(
    "/upload",
    response_model=CodeRepositoryResponse,
    status_code=201,
)
def upload_repository(
    name: str = Form(...),
    project_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ingestion is by far the most expensive operation in the app:
    # it parses, embeds and writes thousands of rows synchronously.
    if not rag_rate_limiter.check(current_user.id):
        raise HTTPException(
            status_code=429,
            detail="Too many requests, please slow down",
        )

    # Duplicated in ArchiveService on purpose: rejecting here avoids
    # creating a temp directory and writing the upload to disk first.
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail="Only .zip archives are supported",
        )

    service = CodeGraphService(db)

    return service.ingest_zip(
        name=name,
        file=file,
        project_id=project_id,
        organisation_id=current_user.organisation_id,
    )


# --------------------------------------------------
# LIST / GET
# --------------------------------------------------


@router.get("", response_model=list[CodeRepositoryResponse])
def list_repositories(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CodeGraphService(db)

    return service.get_repositories(
        project_id=project_id,
        organisation_id=current_user.organisation_id,
    )


@router.get("/{repository_id}", response_model=CodeRepositoryResponse)
def get_repository(
    repository_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CodeGraphService(db)

    return service.get_repository(
        repository_id=repository_id,
        organisation_id=current_user.organisation_id,
    )


# --------------------------------------------------
# GRAPH READS
# --------------------------------------------------


@router.get("/{repository_id}/stats")
def get_repository_stats(
    repository_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CodeGraphService(db)

    # Authorize through Postgres BEFORE touching Neo4j. Without this,
    # any authenticated user could read another org's code structure
    # by guessing a repository_id.
    service.get_repository(
        repository_id=repository_id,
        organisation_id=current_user.organisation_id,
    )

    try:
        return CodeGraphRepository().get_stats(repository_id)
    except Exception as exc:
        # The graph is a secondary store: report it as unavailable
        # rather than surfacing a Bolt stack trace as a 500.
        raise HTTPException(
            status_code=503,
            detail=f"Graph store unavailable: {exc}",
        )


@router.get(
    "/{repository_id}/graph",
    response_model=GraphNeighboursResponse,
)
def get_graph_neighbours(
    repository_id: int,
    fqn: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One node's callers, callees and bases. Debug view for the graph."""
    service = CodeGraphService(db)

    service.get_repository(
        repository_id=repository_id,
        organisation_id=current_user.organisation_id,
    )

    try:
        result = CodeGraphRepository().get_neighbours(repository_id, fqn)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Graph store unavailable: {exc}",
        )

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"No graph node found for fqn {fqn}",
        )

    node = result["node"]

    return GraphNeighboursResponse(
        fqn=node["fqn"],
        kind=node["kind"],
        file_path=node["file_path"],
        start_line=node["start_line"],
        end_line=node["end_line"],
        signature=node.get("signature", ""),
        docstring=node.get("docstring", ""),
        parent=result["parent"],
        callers=result["callers"],
        callees=result["callees"],
        bases=result["bases"],
    )


# --------------------------------------------------
# DELETE
# --------------------------------------------------


@router.delete("/{repository_id}")
def delete_repository(
    repository_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CodeGraphService(db)

    return service.delete_repository(
        repository_id=repository_id,
        organisation_id=current_user.organisation_id,
    )
