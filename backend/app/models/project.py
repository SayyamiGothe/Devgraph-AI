from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship


from app.database.session import Base


class Project(Base):
    """
    A project belongs to a workspaces.

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

    # workspaces foreign key
    workspaces_id = Column(
        Integer,
        ForeignKey("workspaces.id"),
        nullable=False,
    )

# Project.workspaces  → Workspace
# Workspace.projects  → list of Projects
    # Relationship with workspaces
    workspaces = relationship(
        "Workspace",
        back_populates="projects",
    )

    documents = relationship(
    "Document",
    back_populates="project",
    cascade="all, delete-orphan",
)

    @property
    def organisation_id(self) -> int:
        """
        A project has no organisation column of its own.

        It inherits the organisation from the workspace it lives in.
        """
        return self.workspaces.organisation_id

