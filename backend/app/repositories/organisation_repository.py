from sqlalchemy.orm import Session

from app.models.organisations import Organisations


class OrganisationRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, organisation_id: int):
        return (
            self.db.query(Organisations)
            .filter(Organisations.id == organisation_id)
            .first()
        )

    def update(self, organisation):
        self.db.commit()
        self.db.refresh(organisation)

        return organisation
