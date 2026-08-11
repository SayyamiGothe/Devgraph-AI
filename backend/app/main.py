from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.auth.router import router as auth_router
from app.api.project.router import router as project_router
from app.api.workspace.router import router as workspace_router

from app.database.session import get_db

# Create the FastAPI application
app = FastAPI(
    title="DevGraph AI",
    description="GenAI Document Intelligence Platform",
    version="1.0.0",
)


app.include_router(auth_router)
app.include_router(workspace_router)
app.include_router(project_router)