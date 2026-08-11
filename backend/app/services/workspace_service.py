from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.workspaces import Workspace
from app.repositories.workspace_repository import WorkspaceRepository


class WorkspaceService:

    def __init__(self, db: Session):
        self.workspace_repository = WorkspaceRepository(db)

    def create_workspace(
        self,
        name: str,
        organisation_id: int,
    ):
        workspace = Workspace(
            name=name,
            organisation_id=organisation_id,
        )

        return self.workspace_repository.create(workspace)

    def get_workspace(
        self,
        workspace_id: int,
        organisation_id: int,
    ):
        workspace = self.workspace_repository.get_by_id(workspace_id)

        if not workspace:
            raise HTTPException(
                status_code=404,
                detail="Workspace not found",
            )

        # Important security check
        if workspace.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this workspace",
            )

        return workspace

    def get_workspaces(self, organisation_id: int):
        return self.workspace_repository.get_by_organisation(
            organisation_id
        )

    def update_workspace(
        self,
        workspace_id: int,
        name: str | None,
        organisation_id: int,
    ):
        workspace = self.get_workspace(
            workspace_id,
            organisation_id,
        )

        if name is not None:
            workspace.name = name

        return self.workspace_repository.update(workspace)

    def delete_workspace(
        self,
        workspace_id: int,
        organisation_id: int,
    ):
        workspace = self.get_workspace(
            workspace_id,
            organisation_id,
        )

        self.workspace_repository.delete(workspace)

        return {
            "message": "Workspace deleted successfully"
        }
