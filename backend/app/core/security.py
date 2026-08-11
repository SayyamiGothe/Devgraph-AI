from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.core.config import settings
from jose import JWTError, jwt

from app.database.session import get_db
from app.repositories.user_repository import UserRepository

# Password hashing configuration
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# The oauth2_scheme=OAuth2PasswordBearer('/auth/login')
# configuration is used to enable OAuth2 Password Flow
# authentication in FastAPI by telling the framework where clients should send
#  their username and password to obtain an access token.
oauth2_scheme = OAuth2PasswordBearer("/auth/login")


def hash_password(password: str) -> str:
    """
    Convert a plain-text password into a secure hash.
    """
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """
    Compare a plain password with its stored hash.
    """

    return pwd_context.verify(
        plain_password,
        hashed_password,
    )


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_refresh_token(data:dict):
    payload=data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )

    payload["exp"] = expire
    payload["type"] = "refresh"

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )







# we are writing the  jwt decoding logic heree
# validate token
# extract user ID
# find user
# return user
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="not authenticated",
        headers={"WWW-authenticated": "Bearer"},
    )
    try:
        payload=jwt.decode(token,settings.JWT_SECRET_KEY,algorithms=[settings.JWT_ALGORITHM])

        user_id=payload.get("sub")

        if user_id is None:
            raise credentials_exception
        
    except JWTError:
        raise credentials_exception

    user_repository = UserRepository(db)
    user = user_repository.get_by_id(int(user_id))

    if user is None:
        raise credentials_exception

    return user



#decode refresh token jwt
def verify_refresh_token(token: str):

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=404,
                detail="Invalid refresh token"
            )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid refresh token"
            )

        return user_id

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )