from sqlalchemy import Column, ForeignKey, Index, Integer, String, Text
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
    code_fqn = Column(
        String(500),
        nullable=True,
        index=True,
    )

    code_kind = Column(
        String(20),
        nullable=True,
    )

    start_line = Column(
        Integer,
        nullable=True,
    )

    end_line = Column(
        Integer,
        nullable=True,
    )

    # Declared here, not only in raw SQL, so that
    # `alembic revision --autogenerate` sees them as intentional.
    # Otherwise every future autogenerate emits DROP INDEX for them.
    __table_args__ = (
        Index(
            "document_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index(
            "document_chunks_search_vector_gin",
            "search_vector",
            postgresql_using="gin",
        ),
    )