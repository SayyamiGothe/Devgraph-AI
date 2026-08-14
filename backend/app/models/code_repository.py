from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.session import Base


class CodeRepository(Base):
    """
    One uploaded repository zip.

    Its Python source becomes:
      - a graph of nodes/edges in Neo4j (scoped by this row's id)
      - Document + DocumentChunk rows in Postgres for vector retrieval
    """

    __tablename__ = "code_repositories"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    name = Column(
        String(255),
        nullable=False,
    )

    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        nullable=False,
    )

    zip_path = Column(
        String(500),
        nullable=False,
    )

    # processing | ready | failed
    status = Column(
        String(20),
        nullable=False,
        default="processing",
    )

    error = Column(
        Text,
        nullable=True,
    )

    file_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    skipped_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    node_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    edge_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    project = relationship(
        "Project",
        back_populates="code_repositories",
    )

    documents = relationship(
        "Document",
        back_populates="code_repository",
        cascade="all, delete-orphan",
    )