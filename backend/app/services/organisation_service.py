from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.organisation_repository import OrganisationRepository


class OrganisationService:

    def __init__(self, db: Session):
        self.organisation_repository = OrganisationRepository(db)

    def get_my_organisation(self, organisation_id: int):
        organisation = self.organisation_repository.get_by_id(
            organisation_id
        )

        if not organisation:
            raise HTTPException(
                status_code=404,
                detail="Organisation not found",
            )

        return organisation

    def update_my_organisation(
        self,
        organisation_id: int,
        name: str,
    ):
        organisation = self.organisation_repository.get_by_id(
            organisation_id
        )

        if not organisation:
            raise HTTPException(
                status_code=404,
                detail="Organisation not found",
            )

        organisation.name = name

        return self.organisation_repository.update(
            organisation
        )