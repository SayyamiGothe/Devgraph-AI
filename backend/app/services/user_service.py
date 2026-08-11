from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.core.security import hash_password


class UserService:

    def __init__(self, db: Session):
        self.user_repository = UserRepository(db)

    def get_users(self, organisation_id: int):
        return self.user_repository.get_by_organisation(organisation_id)

    def create_user(
        self,
        email: str,
        password: str,
        role: str,
        organisation_id: int,
    ):
        existing_user = self.user_repository.get_by_email(email)

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="User with this email already exists",
            )

        user = User(
            email=email,
            password_hash=hash_password(password),
            role=role,
            organisation_id=organisation_id,
        )

        return self.user_repository.create(user)

    def get_user(
        self,
        user_id: int,
        organisation_id: int,
    ):
        user = self.user_repository.get_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        if user.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this user",
            )

        return user

    def update_user(
    self,
    user_id: int,
    role: str | None,
    organisation_id: int,
):
     user = self.get_user(
        user_id=user_id,
        organisation_id=organisation_id,
    )

     if role is not None:
        user.role = role

     return self.user_repository.update(user)

    def delete_user(
    self,
    user_id: int,
    organisation_id: int,
):
     user = self.get_user(
        user_id=user_id,
        organisation_id=organisation_id,
    )

     self.user_repository.delete(user)
 
     return {
        "message": "User deleted successfully"
    }

  