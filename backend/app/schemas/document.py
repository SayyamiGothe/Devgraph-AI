from pydantic import BaseModel


class DocumentCreate(BaseModel):
    name: str
    file_path: str
    project_id: int

class DocumentUpdate(BaseModel):
    name: str | None = None
    file_path: str | None = None

class DocumentResponse(BaseModel):
    id: int
    name: str
    file_path: str
    project_id: int

# allows:

# SQLAlchemy Document
#        ↓
# DocumentResponse
#        ↓
# JSON response
    class Config:
        from_attributes = True