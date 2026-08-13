from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.refresh_token import RefreshToken
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from app.models.user import User


class AuthService:

    def __init__(self, db: Session):

        self.user_repository = UserRepository(db)
        self.refresh_token_repository = RefreshTokenRepository(db)

    def register(self, email: str, password: str, organisation_id: int):

        # Check whether email already exists
        existing_user = self.user_repository.get_by_email(email)

        if existing_user:
            raise HTTPException(status_code=400, detail="email alredy exist")

        password_hash = hash_password(password)

        # Create User object so that it will add to the user table

        user = User(
            email=email,
            password_hash=password_hash,
            role="USER",
            organisation_id=organisation_id,
        )

        # Save user
        return self.user_repository.create(user)

    def login(self, email: str, password: str):

        user = self.user_repository.get_by_email(email)

        if not user:
            raise HTTPException(status_code=404, detail="unathorized")

        if not verify_password(password, user.password_hash):
            raise HTTPException(status_code=404, detail="Invalid password")

        access_token = create_access_token(
            data={"sub": str(user.id), "email": str(user.email)}
        )

        refresh_token = create_refresh_token(data={"sub": str(user.id)})

        refresh_token_record = RefreshToken(
            token=refresh_token,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )

        self.refresh_token_repository.create(refresh_token_record)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    def refresh_access_token(self, refresh_token: str):
        """
        Exchange a valid refresh token for a fresh access token.

        The token has to satisfy three things: it decodes as a refresh token,
        we still have a record of it, and that record is neither revoked nor
        expired. The refresh token itself is left in place so the client can
        keep using it until it expires.
        """

        user_id = verify_refresh_token(refresh_token)

        record = self.refresh_token_repository.get_by_token(refresh_token)

        if not record:
            raise HTTPException(status_code=401, detail="Refresh token not found")

        if record.revoked:
            raise HTTPException(status_code=401, detail="Refresh token revoked")

        expires_at = record.expires_at

        # SQLite (and older rows) can hand back a naive datetime.
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Refresh token expired")

        user = self.user_repository.get_by_id(int(user_id))

        if not user:
            raise HTTPException(status_code=401, detail="User no longer exists")

        access_token = create_access_token(
            data={"sub": str(user.id), "email": str(user.email)}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
        }

    def logout(self, refresh_token: str):

        token = self.refresh_token_repository.get_by_token(refresh_token)

        if not token:
            raise HTTPException(status_code=404, detail="Refresh token not found")

        if token.revoked:
            raise HTTPException(status_code=400, detail="Refresh token already revoked")

        self.refresh_token_repository.revoke(token)

        return {"message": "Logout successful"}
