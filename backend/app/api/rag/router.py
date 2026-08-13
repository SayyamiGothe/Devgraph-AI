from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.core.rate_limiter import rag_rate_limiter

from app.repositories.conversation_repsitory import ConversationRepository

from app.schemas.rag import RAGRequest, RAGResponse
from app.services.rag_service import RAGService
from app.repositories.project_repository import ProjectRepository

router = APIRouter(
    prefix="/rag",
    tags=["RAG"],
)

# RETRIEVE CHUNKS


@router.get("/retrieve")
def retrieve_chunks(
    question: str,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # ------------------------------------------
    # 1. Check project belongs to user's org
    # ------------------------------------------

    project_repository = ProjectRepository(db)

    project = project_repository.get_for_organization(
        project_id=project_id,
        organisation_id=current_user.organisation_id,
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )
    # 2. Retrieve chunks

    service = RAGService(db)

    chunks = service.retrieve(
        question=question,
        project_id=project_id,
        top_k=5,
    )

   
    # 3. Return chunks
   

    return [
        {
            "document_id": chunk.document_id,
            "chunk_id": chunk.id,
            "chunk_index": chunk.chunk_index,
            "text": chunk.chunk_text,
        }
        for chunk in chunks
    ]


# --------------------------------------------------
# ASK QUESTION
# --------------------------------------------------


@router.post(
    "/ask",
    response_model=RAGResponse,
)
def ask_question(
    request: RAGRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # 1. Validate project ownership
    project_repository = ProjectRepository(db)

    project = project_repository.get_for_organization(
        project_id=request.project_id,
        organisation_id=current_user.organisation_id,
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    # 2. Validate conversation ownership
    conversation_repository = ConversationRepository(db)

    conversation = conversation_repository.get_for_user(
        conversation_id=request.conversation_id,
        organisation_id=current_user.organisation_id,
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    # 3. Make sure conversation belongs to project
    if conversation.project_id != request.project_id:
        raise HTTPException(
            status_code=400,
            detail="Conversation does not belong to this project",
        )

    # 4. Create RAG service
    service = RAGService(db)

    # 5. Execute RAG
    result = service.answer_question(
        question=request.question,
        project_id=request.project_id,
        conversation_id=request.conversation_id,
        organisation_id=current_user.organisation_id,
        top_k=request.top_k,
    )

    # 6. Return response
    return RAGResponse(
        question=request.question,
        project_id=request.project_id,
        answer=result["answer"],
        sources=result["sources"],
    )
