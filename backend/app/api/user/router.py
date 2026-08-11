from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_admin
from app.database.session import get_db
from app.models.user import User
from app.schemas.user import UserCreateRequest, UserUpdateRequest
from app.services.user_service import UserService


router = APIRouter(
    prefix="/user",
    tags=["User"],
)

@router.post("")
def create_user(
    request: UserCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = UserService(db)

    return service.create_user(
        email=request.email,
        password=request.password,
        role=request.role,
        organisation_id=current_user.organisation_id,
    )

@router.get("/{user_id}")
def get_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = UserService(db)

    return service.get_user(
        user_id=user_id,
        organisation_id=current_user.organisation_id,
    )

@router.put("/{user_id}")
def update_user(
    user_id: int,
    request: UserUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = UserService(db)

    return service.update_user(
        user_id=user_id,
        role=request.role,
        organisation_id=current_user.organisation_id,
    )

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = UserService(db)

    return service.delete_user(
        user_id=user_id,
        organisation_id=current_user.organisation_id,
    )