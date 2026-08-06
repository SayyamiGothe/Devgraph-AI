from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database.session import Base


class User(Base):
    """
    Application user.

    A user belongs to an organization.
    """

    __tablename__ = "users"

    # Primary key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # User email
    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    # Never store the plain-text password.
    password_hash = Column(
        String(255),
        nullable=False,
    )

    # User role
    role = Column(
        String(20),
        default="USER",
        nullable=False,
    )

    # Organization foreign key
    organisation_id = Column(
        Integer,
        ForeignKey("organisations.id"),
        nullable=False,
    )

    # Relationship with organization
    organization = relationship(
        "Organisation",
        back_populates="users",
    )
