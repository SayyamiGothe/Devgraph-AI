# DevGraph AI

> Enterprise GenAI Knowledge Assistant powered by RAG, PostgreSQL, pgvector, FastAPI, and Groq.

DevGraph AI is a **Retrieval-Augmented Generation (RAG)** based knowledge assistant that allows users to upload documents and interact with them using natural-language questions.

The system retrieves relevant document chunks using **vector similarity search**, provides the retrieved context to a **Groq-hosted LLM**, and generates grounded responses based on the uploaded documents.

---

## 🚀 Features

### 🔐 Authentication & Authorization

* User registration
* Secure password hashing using bcrypt
* JWT-based authentication
* Access-token based authorization
* Role-based access control
* Organization-level user isolation

### 🏢 Multi-Tenant Architecture

The application follows a hierarchical structure:

```text
Organization
    │
    ├── Users
    │
    └── Workspaces
            │
            └── Projects
                    │
                    └── Documents
                            │
                            └── Document Chunks
```

This allows the application to support multiple organizations and projects.

### 📄 Document Processing

Users can upload documents to a project.

The document pipeline is:

```text
Upload Document
       ↓
Save File
       ↓
Extract Text
       ↓
Split Into Chunks
       ↓
Generate Embeddings
       ↓
Store in PostgreSQL + pgvector
```

### 🧠 Semantic Search

Instead of searching documents using exact keywords, DevGraph AI searches based on **meaning**.

Example:

```text
Question:
"How does authentication work?"

        ↓

Question Embedding

        ↓

pgvector Similarity Search

        ↓

Most Relevant Document Chunks
```

The application uses **cosine similarity** to retrieve the most relevant chunks.

### 🤖 RAG Pipeline

The complete RAG pipeline:

```text
User Question
      ↓
Generate Query Embedding
      ↓
Semantic Search
      ↓
Retrieve Top-K Chunks
      ↓
Build Context
      ↓
Add Conversation History
      ↓
Build Prompt
      ↓
Groq LLM
      ↓
AI Answer
```

### 💬 Conversational Chat

The application supports:

* Chat sessions
* Persistent chat messages
* Conversation history
* Context-aware questions
* AI-generated responses
* Streaming responses

### 📚 Source-Aware Responses

Retrieved document chunks can be associated with their source document and page number.

Example:

```json
{
  "answer": "JWT is used for...",
  "sources": [
    {
      "document": "authentication.pdf",
      "page": 4
    }
  ]
}
```

---

# 🛠️ Technology Stack

## Backend

* Python
* FastAPI
* SQLAlchemy
* Pydantic
* Alembic

## Database

* PostgreSQL
* pgvector

## GenAI

* Groq
* Embeddings
* Retrieval-Augmented Generation
* Semantic Search

## Authentication

* JWT
* bcrypt
* Role-Based Access Control

## Development

* Uvicorn
* Git
* REST APIs

---

# 📁 Project Structure

```text
devgraph-ai/
│
├── backend/
│   │
│   ├── app/
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── router.py
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   └── router.py
│   │   │   │
│   │   │   ├── document/
│   │   │   │   └── router.py
│   │   │   │
│   │   │   └── project/
│   │   │
│   │   ├── core/
│   │   │   ├── security.py
│   │   │   ├── config.py
│   │   │   └── dependencies.py
│   │   │
│   │   ├── database/
│   │   │   └── session.py
│   │   │
│   │   ├── models/
│   │   │   ├── organisation.py
│   │   │   ├── workspace.py
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   ├── document.py
│   │   │   ├── document_chunk.py
│   │   │   ├── chat_session.py
│   │   │   └── chat_message.py
│   │   │
│   │   ├── repositories/
│   │   │   ├── user_repository.py
│   │   │   ├── project_repository.py
│   │   │   ├── document_repository.py
│   │   │   ├── chat_session_repository.py
│   │   │   └── chat_message_repository.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   ├── document.py
│   │   │   └── project.py
│   │   │
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   │
│   │   │   └── ai/
│   │   │       ├── text_extractor.py
│   │   │       ├── chunk_service.py
│   │   │       ├── embedding_service.py
│   │   │       ├── semantic_search.py
│   │   │       ├── llm_service.py
│   │   │       └── rag_service.py
│   │   │
│   │   └── main.py
│   │
│   ├── alembic/
│   │   ├── versions/
│   │   └── env.py
│   │
│   ├── uploads/
│   │
│   ├── .env
│   ├── .gitignore
│   ├── alembic.ini
│   └── pyproject.toml
│
└── README.md
```

---

# 🗄️ Database Architecture

The main database relationships are:

```text
┌─────────────────┐
│  Organization   │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌────────┐  ┌─────────┐
│ Users  │  │Workspace│
└────────┘  └────┬────┘
                 │
                 ▼
             ┌─────────┐
             │ Project │
             └────┬────┘
                  │
                  ▼
             ┌──────────┐
             │ Document │
             └────┬─────┘
                  │
                  ▼
          ┌────────────────┐
          │ DocumentChunk  │
          │                │
          │ content        │
          │ embedding      │
          │ page_number    │
          │ chunk_index    │
          └────────────────┘
```

Chat architecture:

```text
User
 │
 ▼
ChatSession
 │
 ├── User Message
 │
 ├── Assistant Message
 │
 ├── User Message
 │
 └── Assistant Message
```

---

# 🧠 RAG Architecture

DevGraph AI uses Retrieval-Augmented Generation to reduce hallucinations and answer questions using uploaded documents.

## Document Ingestion

```text
PDF / Document
      │
      ▼
Text Extraction
      │
      ▼
Text Chunking
      │
      ▼
Embedding Model
      │
      ▼
Vector
      │
      ▼
PostgreSQL
      │
      ▼
pgvector
```

## Query Pipeline

```text
"What is JWT?"
       │
       ▼
Embedding Model
       │
       ▼
Query Vector
       │
       ▼
pgvector
       │
       ▼
Cosine Similarity
       │
       ▼
Top-K Document Chunks
       │
       ▼
Context
       │
       ▼
Groq LLM
       │
       ▼
Answer
```

---

# 🔎 Vector Search

Document chunks contain an embedding vector:

```text
DocumentChunk

content:
"JWT is a JSON Web Token..."

embedding:
[0.123, -0.421, 0.982, ...]
```

When the user asks:

```text
"What is JWT?"
```

the question is also converted into an embedding.

The application then compares:

```text
Question Vector
       ↓
       ↕
Document Vectors
```

using cosine distance.

The closest vectors are considered the most semantically relevant.

---

# 🤖 Groq Integration

DevGraph AI uses **Groq** for LLM inference.

The LLM receives:

```text
System Instructions
        +
Conversation History
        +
Retrieved Document Context
        +
Current User Question
```

Example prompt structure:

```text
You are an AI assistant.

Use the retrieved document context
to answer the question.

Conversation History:
...

Document Context:
...

Current Question:
...

Answer:
```

The model is instructed not to invent information that is not available in the retrieved documents.

---

# 🔐 Authentication Flow

## Registration

```text
POST /auth/register

       ↓

Validate Input

       ↓

Check Email

       ↓

Hash Password

       ↓

Create User

       ↓

PostgreSQL
```

Passwords are never stored directly.

Instead:

```text
Plain Password
      ↓
bcrypt
      ↓
Password Hash
      ↓
PostgreSQL
```

## Login

```text
POST /auth/login
       ↓
Find User
       ↓
Verify Password
       ↓
Create JWT
       ↓
Return Access Token
```

Protected endpoints require:

```text
Authorization: Bearer <access_token>
```

---

# 📡 API Overview

## Authentication

```text
POST /auth/register
POST /auth/login
```

## Projects

```text
POST   /projects
GET    /projects
GET    /projects/{project_id}
DELETE /projects/{project_id}
```

## Documents

```text
POST /documents/upload
GET  /documents
```

## Chat

```text
POST /chat
POST /chat/stream
```

> Exact endpoints may evolve as the application develops.

---

# ⚙️ Environment Variables

Create:

```text
backend/.env
```

Example:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/devgraph_ai

GROQ_API_KEY=your_groq_api_key

JWT_SECRET_KEY=your_secret_key

JWT_ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Never commit `.env` to Git.**

Add it to `.gitignore`:

```gitignore
.env
backend/.env
__pycache__/
.venv/
uploads/
```

---

# 📦 Installation

## 1. Clone the repository

```bash
git clone <repository-url>
cd devgraph-ai
```

## 2. Go to backend

```bash
cd backend
```

## 3. Create virtual environment

Using `uv`:

```bash
uv venv
```

Activate it on Windows:

```powershell
.venv\Scripts\activate
```

## 4. Install dependencies

```bash
uv sync
```

---

# 🐘 PostgreSQL Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE devgraph_ai;
```

Enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Verify:

```sql
SELECT * FROM pg_extension
WHERE extname = 'vector';
```

---

# 🗃️ Database Migration

Run:

```bash
uv run alembic upgrade head
```

Check current migration:

```bash
uv run alembic current
```

Create a new migration:

```bash
uv run alembic revision --autogenerate -m "migration message"
```

Apply:

```bash
uv run alembic upgrade head
```

---

# ▶️ Running the Application

From the `backend` directory:

```bash
uv run uvicorn app.main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Swagger documentation:

```text
http://127.0.0.1:8000/docs
```

ReDoc:

```text
http://127.0.0.1:8000/redoc
```

---

# 🧪 Example RAG Flow

### 1. Upload a document

```text
POST /documents/upload
```

The application:

```text
Document
   ↓
Extract text
   ↓
Create chunks
   ↓
Generate embeddings
   ↓
Store chunks + vectors
```

### 2. Ask a question

```text
POST /chat
```

Example:

```json
{
  "session_id": 1,
  "question": "What is JWT?"
}
```

### 3. Retrieval

The application retrieves the most relevant chunks using pgvector.

### 4. Generation

The retrieved context is sent to Groq.

### 5. Response

```json
{
  "answer": "JWT is a JSON Web Token used for...",
  "sources": [
    {
      "document": "authentication.pdf",
      "page": 4
    }
  ]
}
```

---

# 🏗️ Architecture

DevGraph AI follows a layered backend architecture:

```text
                    Client
                      │
                      ▼
                FastAPI Router
                      │
                      ▼
                 Service Layer
                      │
             ┌────────┴────────┐
             ▼                 ▼
       Repository Layer     AI Services
             │                 │
             ▼                 ├── Embeddings
        PostgreSQL             ├── Semantic Search
             │                 ├── RAG
             │                 └── Groq
             ▼
           pgvector
```

### Router Layer

Responsible for:

* HTTP requests
* Request validation
* Authentication dependencies
* HTTP responses

### Service Layer

Responsible for:

* Business logic
* RAG orchestration
* Authentication
* Document processing

### Repository Layer

Responsible for:

* Database queries
* Creating records
* Updating records
* Fetching records

### AI Service Layer

Responsible for:

* Text extraction
* Chunking
* Embeddings
* Semantic search
* LLM calls
* RAG

---

# 🔒 Security

The project follows several security practices:

* Passwords are hashed using bcrypt.
* JWT tokens are used for authentication.
* Protected endpoints use authorization dependencies.
* `.env` files are excluded from Git.
* Organization-level access checks are applied to resources.
* User roles are stored for RBAC.
* Secrets are not hardcoded into application code.

---

# 🚧 Future Improvements

Planned improvements include:

* Advanced RBAC
* Refresh token authentication
* Streaming chat using Server-Sent Events
* Hybrid keyword + vector retrieval
* Reranking retrieved chunks
* Query rewriting
* Conversation summarization
* LangChain integration
* LangGraph-based agent workflows
* Redis caching
* Background document processing
* Celery task workers
* Observability with Langfuse
* Automated testing
* Docker deployment
* CI/CD pipeline
* Production deployment

---

# 📈 Learning & Engineering Concepts Demonstrated

This project demonstrates practical experience with:

```text
Python
FastAPI
REST APIs
PostgreSQL
SQLAlchemy
Alembic
JWT
RBAC
bcrypt
Vector Databases
pgvector
Embeddings
Semantic Search
RAG
LLMs
Groq
Prompt Engineering
Conversation Memory
Streaming
Repository Pattern
Service Layer Architecture
Multi-Tenant Architecture
```

---

# 👨‍💻 Author

**Sayyami Gothe**

GenAI / Python Backend Developer

---

# 📄 License

This project is intended for educational and portfolio purposes.
