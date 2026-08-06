from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
 
    email: EmailStr
    password: str
    organization_id: int


class RegisterResponse(BaseModel):
    """
    Data returned after registration.
    """

    id: int
    email: EmailStr
    role: str
    organization_id: int

    class Config:
        from_attributes = True
