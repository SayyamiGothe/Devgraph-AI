# role define to check wherether it is accessable or not
from fastapi import Depends, HTTPException

from app.models.user import User
from app.core.security import get_current_user


def require_roles(required_roles: list[str]):

    def role_checker(
        current_user: User = Depends(get_current_user),
    ):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions",
            )

        return current_user

    return role_checker


def require_admin(
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return current_user
