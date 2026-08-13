from pydantic import BaseModel, ConfigDict


class ChatMessageResponse(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str

    model_config = ConfigDict(
        from_attributes=True
    )