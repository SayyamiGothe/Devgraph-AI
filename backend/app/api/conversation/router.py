from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.repositories.conversation_repsitory import ConversationRepository
from app.schemas.conversation import ConversationCreate, ConversationResponse
from app.services.conversation_service import ConversationService




router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)


@router.post(
    "",
    response_model=ConversationResponse,
)
def create_conversation(
    request: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    service = ConversationService(db)

    conversation = service.create_conversation(
        project_id=request.project_id,
        title=request.title,
    )

    return conversation


@router.get(
    "/{conversation_id}",
    response_model=ConversationResponse,
)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    service = ConversationService(db)

    conversation = service.get_conversation(
        conversation_id=conversation_id
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    return conversation

@router.get(
    "/project/{project_id}",
    response_model=list[ConversationResponse],
)
def get_project_conversations(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    repository = ConversationRepository(db)

    conversations = repository.get_by_project(
        project_id=project_id
    )

    return conversations