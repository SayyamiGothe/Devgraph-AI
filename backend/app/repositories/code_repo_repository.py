from sqlalchemy.orm import Session

from app.models.code_repository import CodeRepository


class CodeRepoRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, repository: CodeRepository):
        self.db.add(repository)
        self.db.commit()
        self.db.refresh(repository)

        return repository

    def get_by_id(self, repository_id: int):
        return (
            self.db.query(CodeRepository)
            .filter(CodeRepository.id == repository_id)
            .first()
        )

    def get_by_project(self, project_id: int):
        return (
            self.db.query(CodeRepository)
            .filter(CodeRepository.project_id == project_id)
            .order_by(CodeRepository.created_at.desc())
            .all()
        )

    def get_by_name(self, project_id: int, name: str):
        return (
            self.db.query(CodeRepository)
            .filter(
                CodeRepository.project_id == project_id,
                CodeRepository.name == name,
            )
            .first()
        )

    def update(self, repository: CodeRepository):
        self.db.commit()
        self.db.refresh(repository)

        return repository

    def delete(self, repository: CodeRepository):
        self.db.delete(repository)
        self.db.commit()
