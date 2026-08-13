from pydantic import BaseModel


class ConversationCreate(BaseModel):
    project_id: int
    title: str | None = None


class ConversationResponse(BaseModel):
    id: int
    project_id: int
    title: str | None = None

    class Config:
        from_attributes = True