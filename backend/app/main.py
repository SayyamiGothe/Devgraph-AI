from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.auth.router import router as auth_router
from app.api.project.router import router as project_router
from app.api.workspace.router import router as workspace_router
from app.api.user.router import router as user_router
from app.api.document.router import router as document_router
from app.api.rag.router import router as rag_router
from app.api.organisation.router import router as organisation_router
from app.core.config import settings
from app.api.conversation.router import (
    router as conversation_router,
)
from app.api.chat_message.router import (
    router as chat_message_router,
)
from fastapi.middleware.cors import CORSMiddleware

from app.database.session import get_db

# Create the FastAPI application
app = FastAPI(
    title="DevGraph AI",
    description="GenAI Document Intelligence Platform",
    version="1.0.0",
)

@app.get("/")
def root():
    return {"message": "DevGraph AI backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL
    ],
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)


app.include_router(auth_router)
app.include_router(organisation_router)
app.include_router(workspace_router)
app.include_router(project_router)
app.include_router(user_router)
app.include_router(document_router)
app.include_router(rag_router)
app.include_router(conversation_router)
app.include_router(chat_message_router)