from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_admin
from app.core.security import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.organisation import OrganisationUpdateRequest
from app.services import organisation_service


router = APIRouter(
    prefix="/organistion",
    tags=["Organisation"],
)


@router.get("/organisation")
def get_my_organisation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = organisation_service(db)

    return service.get_my_organisation(
        current_user.organisation_id
    )

@router.put("/organisation")
def update_my_organisation(
    request: OrganisationUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = organisation_service(db)

    return service.update_my_organisation(
        organisation_id=current_user.organisation_id,
        name=request.name,
    )