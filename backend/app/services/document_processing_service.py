from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

# What PyPDFLoader does

# Suppose the uploaded PDF contains:

# Page 1:
# My name is Sayyami.
# I am a Python developer.

# Page 2:
# I have experience with FastAPI
# and LangChain.

# The loader gives you LangChain Document objects roughly like:

# [
#     Document(
#         page_content="My name is Sayyami...",
#         metadata={
#             "page": 0,
#             "source": "uploads/abc.pdf"
#         }
#     ),

#     Document(
#         page_content="I have experience...",
#         metadata={
#             "page": 1,
#             "source": "uploads/abc.pdf"
#         }
#     )
# ]

# So we are not yet creating embeddings.


class DocumentProcessingService:

    def __init__(self):

        self.embedding_model = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

    # 1. load document
    def load_pdf(self, file_path: str):

        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        loader = PyPDFLoader(str(path))

        documents = loader.load()

        return documents

    # 2.split document
    def split_documents(self, documents):

        # Instead of blindly cutting every 1000 characters, it tries to split at sensible boundaries such as:
        # paragaraphs-lines-sentence-words-charchters
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        chunks = splitter.split_documents(documents)

        return chunks

    # 3.embiddings
    def generate_embeddings(self, chunks):

        texts = [chunk.page_content for chunk in chunks]

        embeddings = self.embedding_model.embed_documents(texts)

        return embeddings

    # 4 complete processings
    def process_document(self, file_path: str):

        # Load PDF
        documents = self.load_pdf(file_path)

        # Split into chunks
        chunks = self.split_documents(documents)

        # Generate embeddings
        embeddings = self.generate_embeddings(chunks)

        return chunks, embeddings

    def generate_query_embedding(self, question: str):

     return self.embedding_model.embed_query(question)

    # ---- shared with the code-ingestion path ----

    def get_splitter(self):
        return RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )

    def embed_texts(self, texts):
        """Batch embedding for already-prepared strings."""
        return self.embedding_model.embed_documents(texts)


# The embedding model is ~90MB and reloads on every instantiation.
# RAGService built one per request, i.e. per question asked.
_shared_processing_service = None


def get_processing_service() -> DocumentProcessingService:
    global _shared_processing_service

    if _shared_processing_service is None:
        _shared_processing_service = DocumentProcessingService()

    return _shared_processing_service
