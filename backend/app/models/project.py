from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database.session import Base


class Project(Base):
    """
    A project belongs to a workspace.

    Later, documents will belong to projects.
    """

    __tablename__ = "projects"

    # Primary key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # Project name
    name = Column(
        String(150),
        nullable=False,
    )

    # Optional project description
    description = Column(
        String(500),
        nullable=True,
    )

    # Workspace foreign key
    workspace_id = Column(
        Integer,
        ForeignKey("workspaces.id"),
        nullable=False,
    )

    # Relationship with workspace
    workspace = relationship(
        "Workspace",
        back_populates="projects",
    )
