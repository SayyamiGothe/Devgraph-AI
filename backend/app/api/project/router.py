from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session


from app.core.security import get_current_user
from app.database.session import get_db
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.project_service import ProjectService

from app.models.user import User

router = APIRouter(
    prefix="/projects",
    tags=["Projects"],
)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    request: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ProjectService(db)

    return service.create_project(
        name=request.name,
        description=request.description,
        workspaces_id=request.workspaces_id,
        organisation_id=current_user.organisation_id,
    )


@router.get(
    "",
    response_model=list[ProjectResponse],
)
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ProjectService(db)

    return service.get_projects(
        organisation_id=current_user.organisation_id,
    )


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ProjectService(db)

    return service.get_project(
        project_id=project_id,
        organisation_id=current_user.organisation_id,
    )


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
)
def update_project(
    project_id: int,
    request: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ProjectService(db)

    return service.update_project(
        project_id=project_id,
        name=request.name,
        description=request.description,
        organisation_id=current_user.organisation_id,
    )


@router.delete(
    "/{project_id}",
)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ProjectService(db)

    return service.delete_project(
        project_id=project_id,
        organisation_id=current_user.organisation_id,
    )

