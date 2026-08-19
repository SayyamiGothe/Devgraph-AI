from pydantic import BaseModel, Field


class RAGRequest(BaseModel):
    # " Filed says that This must be a required string containing at least 1 character."
    question: str = Field(..., min_length=1)
    project_id: int
    conversation_id: int
    top_k: int = Field(default=5, ge=1, le=20)


class RAGSource(BaseModel):

    document_id: int
    chunk_id: int
    document_name: str
    chunk_index: int

    # Populated only for code chunks. Defaults of None keep every
    # existing PDF response shape valid.
    code_fqn: str | None = None
    file_path: str | None = None
    start_line: int | None = None
    end_line: int | None = None


class RAGResponse(BaseModel):

    question: str
    project_id: int
    answer: str
    sources: list[RAGSource]
