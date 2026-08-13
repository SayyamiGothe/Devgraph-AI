from pydantic import BaseModel, Field


class RAGRequest(BaseModel):
    # " Filed says that This must be a required string containing at least 1 character."
    question: str = Field(..., min_length=1)
    project_id: int
    conversation_id:int
    top_k: int = Field(default=5, ge=1, le=20),
    conversation_id:int


class RAGSource(BaseModel):

    document_id: int
    chunk_id: int
    document_name: str
    chunk_index: int


class RAGResponse(BaseModel):

    question: str
    project_id: int
    answer: str
    sources: list[RAGSource]
