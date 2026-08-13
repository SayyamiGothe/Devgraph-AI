from sqlalchemy.orm import Session

from app.models.chat_message import ChatMessage


class ChatMessageRepository:

    def __init__(self, db: Session):
        self.db = db

    def create_message(
        self,
        conversation_id: int,
        role: str,
        content: str,
    ):

        message = ChatMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
    )

        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)

        return message

    def get_messages(
        self,
        conversation_id: int,
        limit: int = 10,
    ):

        return (
            self.db.query(ChatMessage)
            .filter(
                ChatMessage.conversation_id == conversation_id
            )
            .order_by(ChatMessage.id.desc())
            .limit(limit)
            .all()
        )