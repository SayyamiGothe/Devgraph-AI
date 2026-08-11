from sqlalchemy.orm import Session

from app.models.workspaces import Workspace


class WorkspaceRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, workspace: Workspace):
        self.db.add(workspace)
        self.db.commit()
        self.db.refresh(workspace)

        return workspace

    def get_by_id(self, workspace_id: int):
        return (
            self.db.query(Workspace)
            .filter(Workspace.id == workspace_id)
            .first()
        )

    def get_by_organisation(self, organisation_id: int):
        return (
            self.db.query(Workspace)
            .filter(Workspace.organisation_id == organisation_id)
            .all()
        )

    def update(self, workspace: Workspace):
        self.db.commit()
        self.db.refresh(workspace)

        return workspace

    def delete(self, workspace: Workspace):
        self.db.delete(workspace)
        self.db.commit()
