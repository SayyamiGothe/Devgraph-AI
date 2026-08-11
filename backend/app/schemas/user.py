from pydantic import BaseModel, EmailStr


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"

class UserUpdateRequest(BaseModel):
    role: str | None = None