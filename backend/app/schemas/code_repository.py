from datetime import datetime

from pydantic import BaseModel


class CodeRepositoryResponse(BaseModel):
    id: int
    name: str
    project_id: int
    status: str
    error: str | None = None
    file_count: int
    skipped_count: int
    node_count: int
    edge_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class CodeNodeSummary(BaseModel):
    fqn: str
    kind: str
    file_path: str
    start_line: int
    end_line: int
    signature: str = ""


class GraphNeighboursResponse(BaseModel):
    fqn: str
    kind: str
    file_path: str
    start_line: int
    end_line: int
    signature: str = ""
    docstring: str = ""
    parent: str | None = None
    callers: list[str] = []
    callees: list[str] = []
    bases: list[str] = []
