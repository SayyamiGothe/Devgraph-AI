from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.security import get_current_user
from app.models.user import User

from app.schemas.chat_message import ChatMessageResponse

from app.repositories.chat_message_repository import (
    ChatMessageRepository,
)


router = APIRouter(
    prefix="/chat-messages",
    tags=["Chat Messages"],
)


@router.get(
    "/conversation/{conversation_id}",
    response_model=list[ChatMessageResponse],
)
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    repository = ChatMessageRepository(db)

    messages = repository.get_messages(
        conversation_id=conversation_id,
        limit=50,
    )

    # Repository returns newest first.
    # Frontend normally wants oldest → newest.
    messages.reverse()

    return messages