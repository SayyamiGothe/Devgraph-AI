from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):

    email: EmailStr
    password: str
    organisation_id: int


class RegisterResponse(BaseModel):
    """
    Data returned after registration.
    """

    id: int
    email: EmailStr
    role: str
    organisation_id: int

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token:str
    token_type: str

class LogoutRequest(BaseModel):
    refresh_token: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UserRole:
    USER = "user"
    ADMIN = "admin"