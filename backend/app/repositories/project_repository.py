from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.workspaces import Workspace


class ProjectRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, project: Project):
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)

        return project

    def get_by_id(self, project_id: int):
        return (
            self.db.query(Project)
            .filter(Project.id == project_id)
            .first()
        )

    def get_by_workspace(self, workspaces_id: int):
        return (
            self.db.query(Project)
            .filter(Project.workspaces_id == workspaces_id)
            .all()
        )

    def get_by_organisation(self, organisation_id: int):

        return (
        self.db.query(Project)
        .join(Workspace, Project.workspaces_id == Workspace.id)
        .filter(Workspace.organisation_id == organisation_id)
        .all()
    )

    def update(self, project: Project):
        self.db.commit()
        self.db.refresh(project)

        return project

    def delete(self, project: Project):
        self.db.delete(project)
        self.db.commit()