from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.repositories.conversation_repsitory import ConversationRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.conversation import ConversationCreate, ConversationResponse
from app.services.conversation_service import ConversationService

router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)


# Every route here is org-scoped. Previously they were authenticated
# but NOT authorized, so any logged-in user could create a conversation
# on any project and read any conversation by guessing its id.


@router.post(
    "",
    response_model=ConversationResponse,
)
def create_conversation(
    request: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    project_repository = ProjectRepository(db)

    project = project_repository.get_for_organisation(
        project_id=request.project_id,
        organisation_id=current_user.organisation_id,
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

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

    repository = ConversationRepository(db)

    # get_for_user joins through project -> workspace -> organisation.
    # It already existed but was only used by /rag/ask.
    conversation = repository.get_for_user(
        conversation_id=conversation_id,
        organisation_id=current_user.organisation_id,
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

    project_repository = ProjectRepository(db)

    project = project_repository.get_for_organisation(
        project_id=project_id,
        organisation_id=current_user.organisation_id,
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    repository = ConversationRepository(db)

    return repository.get_by_project(project_id=project_id)
