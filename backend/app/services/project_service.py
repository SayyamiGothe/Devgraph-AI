from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.project import Project
from app.repositories.project_repository import ProjectRepository
from app.services.workspace_service import WorkspaceService


class ProjectService:

    def __init__(self, db: Session):
        self.project_repository = ProjectRepository(db)
        self.workspace_service = WorkspaceService(db)

    def create_project(
        self,
        name: str,
        description: str | None,
        workspaces_id: int,
        organisation_id: int,
    ):
        # Get workspace through WorkspaceService
        workspace = self.workspace_service.get_workspace(workspaces_id,organisation_id)

        if not workspace:
            raise HTTPException(
                status_code=404,
                detail="Workspace not found",
            )

        # Security check
        if workspace.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="Workspace does not belong to your organisation",
            )

        project = Project(
            name=name,
            description=description,
            workspaces_id=workspaces_id,
        )

        return self.project_repository.create(project)

    def get_project(
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

        # Since Project belongs to Workspace,
        # get organisation through workspace.
        workspace = self.workspace_service.get_workspace(
            project.workspaces_id,project.organisation_id
        )

        if not workspace:
            raise HTTPException(
                status_code=404,
                detail="Workspace not found",
            )

        if workspace.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this project",
            )

        return project

    def get_projects(self, organisation_id: int):
        return self.project_repository.get_by_organisation(
            organisation_id
        )

    def update_project(
        self,
        project_id: int,
        name: str | None,
        description: str | None,
        organisation_id: int,
    ):
        project = self.get_project(
            project_id,
            organisation_id,
        )

        if name is not None:
            project.name = name

        if description is not None:
            project.description = description

        return self.project_repository.update(project)

    def delete_project(
        self,
        project_id: int,
        organisation_id: int,
    ):
        project = self.get_project(
            project_id,
            organisation_id,
        )

        self.project_repository.delete(project)

        return {
            "message": "Project deleted successfully"
        }