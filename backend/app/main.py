from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.session import get_db

# Create the FastAPI application
app = FastAPI(
    title="DevGraph AI",
    description="GenAI Document Intelligence Platform",
    version="1.0.0",
)


# Simple health-check endpoint
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "DevGraph AI backend is running",
    }


@app.get("/health/db")
def database_health(db: Session = Depends(get_db),
):
    """
    Test PostgreSQL connectivity.
    """

    result = db.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": result.scalar(),
    }
