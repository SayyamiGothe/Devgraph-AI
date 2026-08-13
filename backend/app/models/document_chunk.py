from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import TSVECTOR

from app.database.session import Base


class DocumentChunk(Base):

    __tablename__ = "document_chunks"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    document_id = Column(
        Integer,
        ForeignKey("documents.id"),
        nullable=False,
    )

    chunk_text = Column(
        Text,
        nullable=False,
    )

    chunk_index = Column(
        Integer,
        nullable=False,
    )

    embedding = Column(
        Vector(384),
        nullable=False,
    )

    document = relationship(
        "Document",
        back_populates="chunks",
    )

    search_vector = Column(
        TSVECTOR,
        nullable=True,
    )