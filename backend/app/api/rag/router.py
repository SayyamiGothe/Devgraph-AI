from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.rag import RAGRequest, RAGResponse
from app.services.rag_service import RAGService


router = APIRouter(
    prefix="/rag",
    tags=["RAG"],
)


@router.get("/retrieve")
def retrieve_chunks(
    question: str,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RAGService(db)

    chunks = service.retrieve(
        question=question,
        project_id=project_id,
        top_k=5,
    )

    return [
        {
            "document_id": chunk.document_id,
            "chunk_id": chunk.id,
            "chunk_index": chunk.chunk_index,
            "text": chunk.chunk_text,
        }
        for chunk in chunks
    ]


@router.post(
    "/ask",
    response_model=RAGResponse,
)
def ask_question(
    request: RAGRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = RAGService(db)

    result = service.answer_question(
        question=request.question,
        project_id=request.project_id,
        top_k=request.top_k,
    )

    return RAGResponse(
        question=request.question,
        answer=result["answer"],
        sources=result["sources"],
        project_id=request.project_id
    )