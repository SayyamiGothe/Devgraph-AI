
"""create documents table

Revision ID: 1cb62c1507c0
Revises: c4271f395b59
Create Date: 2026-08-11 16:45:37.513347
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy


# revision identifiers, used by Alembic.
revision: str = "1cb62c1507c0"
down_revision: Union[str, Sequence[str], None] = "c4271f395b59"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # Enable PostgreSQL pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "document_chunks",

        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "document_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "chunk_text",
            sa.Text(),
            nullable=False,
        ),

        sa.Column(
            "chunk_index",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "embedding",
            pgvector.sqlalchemy.vector.VECTOR(dim=384),
            nullable=False,
        ),

        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
        ),

        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_document_chunks_id"),
        "document_chunks",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        op.f("ix_document_chunks_id"),
        table_name="document_chunks",
    )

    op.drop_table("document_chunks")
