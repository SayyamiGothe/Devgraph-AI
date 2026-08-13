from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.project import Project
from app.models.workspaces import Workspace


class ConversationRepository:

    def __init__(self, db: Session):
        self.db = db

    def create_conversation(
        self,
        project_id: int,
        title: str | None = None,
    ):

        conversation = Conversation(
            project_id=project_id,
            title=title,
        )

        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)

        return conversation

    def get_conversation(
        self,
        conversation_id: int,
    ):

        return (
            self.db.query(Conversation)
            .filter(
                Conversation.id == conversation_id
            )
            .first()
        )

    def get_by_project(
        self,
        project_id: int,
    ):

        return (
            self.db.query(Conversation)
            .filter(
                Conversation.project_id == project_id
            )
            .order_by(
                Conversation.id.desc()
            )
            .all()
        )

    def get_for_user(
    self,
    conversation_id: int,
    organisation_id: int,
):

     return (
        self.db.query(Conversation)
        .join(
            Project,
            Conversation.project_id == Project.id,
        )
        .join(
            Workspace,
            Project.workspaces_id == Workspace.id,
        )
        .filter(
            Conversation.id == conversation_id,
            Workspace.organisation_id == organisation_id,
        )
        .first()
    )