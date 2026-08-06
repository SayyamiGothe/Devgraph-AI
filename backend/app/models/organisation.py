from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database.session import Base


class Organisation(Base):
    """
    Represents a company or organization.

    One organization can have:
    - Many users
    - Many workspaces
    """

    __tablename__ = "organisations"

    # primary key
    id = Column(Integer, primary_key=True, index=True)

    # organisation name
    name = Column(String(100), nullable=False)

    # relationship with user
    users = relationship(
        "User", back_populates="organisation", cascade="all,delete-orphan"
    )

    # relationship with workspace
    workspace = relationship(
        "workspace", back_populates="organisation", cascade="all,delete-orphan"
    )
