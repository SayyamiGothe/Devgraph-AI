from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database.session import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False)

    file_path = Column(String(500), nullable=False)

    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        nullable=False,
    )

    project = relationship(
        "Project",
        back_populates="documents",
    )

    chunks = relationship(
    "DocumentChunk",
    back_populates="document",
    cascade="all, delete-orphan",
)