from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

# The engine manages communication between our application and postgress
engine = create_engine(settings.DATABASE_URL, echo=True)

# Each request will get a database session.
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


# Base class for SQLAlchemy models
class Base(DeclarativeBase):
    pass


# FastAPI database dependency
def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close
