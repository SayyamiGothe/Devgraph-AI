

from app.repositories.conversation_repsitory import ConversationRepository


class ConversationService:

    def __init__(self, db):
        self.repository = ConversationRepository(db)

    def create_conversation(
        self,
        project_id: int,
        title: str | None = None,
    ):

        return self.repository.create_conversation(
            project_id=project_id,
            title=title,
        )

    def get_conversation(
        self,
        conversation_id: int,
    ):

        return self.repository.get_conversation(
            conversation_id=conversation_id
        )