from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database.session import Base


class Workspace(Base):
    """
    A workspaces belongs to an organization.

    One workspaces can contain many projects.
    """

    __tablename__ = "workspaces"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)

    # organisation foregin key
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)

    # relationship to organisations
    organisation = relationship("Organisations", back_populates="workspace")

    # Relationship with projects
    projects = relationship(
        "Project",
        back_populates="workspaces",
        cascade="all, delete-orphan",
    )
