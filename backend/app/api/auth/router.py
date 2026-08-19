from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
)
from app.services.auth_service import AuthService
from app.core.security import get_current_user
from app.models.user import User
from fastapi import Depends

from app.services.user_service import UserService
from app.api.dependencies import require_admin, require_roles

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user.
    """
    auth_service = AuthService(db)

    user = auth_service.register(
        email=request.email,
        password=request.password,
        organisation_id=request.organisation_id,
    )

    return user


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    auth_service = AuthService(db)

    return auth_service.login(email=request.email, password=request.password)


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "organisation_id": current_user.organisation_id,
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # This used to return a success message without deleting anything.
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account",
        )

    service = UserService(db)

    return service.delete_user(
        user_id=user_id,
        organisation_id=current_user.organisation_id,
    )


@router.post("/logout")
def logout(
    request: LogoutRequest,
    db: Session = Depends(get_db),
):

    auth_service = AuthService(db)

    return auth_service.logout(request.refresh_token)


@router.post("/refresh")
def refresh(request: RefreshRequest, db: Session = Depends(get_db)):

    service = AuthService(db)

    return service.refresh_access_token(request.refresh_token)


@router.post("/projects")
def create_project(
    current_user: User = Depends(require_roles(["ADMIN", "MANAGER"])),
):
    return {"message": "Project created"}
