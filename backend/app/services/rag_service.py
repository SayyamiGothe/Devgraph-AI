from app.repositories.document_chunk_repository import DocumentChunkRepository
from app.services.document_processing_service import DocumentProcessingService
from app.services.llm_service import LLMService


class RAGService:

    def __init__(self, db):
        self.db = db

        self.chunk_repository = DocumentChunkRepository(db)

        self.document_processing_service = (
            DocumentProcessingService()
        )

        self.llm_service = LLMService()

    def retrieve(
        self,
        question: str,
        project_id: int,
        top_k: int = 5,
    ):

        # 1. Convert question into embedding
        query_embedding = (
            self.document_processing_service
            .generate_query_embedding(question)
        )

        # 2. Find similar chunks
        chunks = self.chunk_repository.similarity_search(
            query_embedding=query_embedding,
            project_id=project_id,
            top_k=top_k,
        )

        return chunks

    def build_context(self, chunks):

        context_parts = []

        for chunk in chunks:

            document_name = (
                chunk.document.name
                if chunk.document
                else "Unknown document"
            )

            context_parts.append(
                f"""
Source: {document_name}
Chunk: {chunk.chunk_index}

{chunk.chunk_text}
"""
            )

        return "\n\n".join(context_parts)

    def build_sources(self, chunks):

        sources = []

        for chunk in chunks:

            sources.append(
                {
                    "document_id": chunk.document_id,
                    "chunk_id": chunk.id,
                    "document_name": (
                        chunk.document.name
                        if chunk.document
                        else "Unknown document"
                    ),
                    "chunk_index": chunk.chunk_index,
                }
            )

        return sources

    def answer_question(
        self,
        question: str,
        project_id: int,
        top_k: int = 5,
    ):

        # 1. Retrieve relevant chunks
        chunks = self.retrieve(
            question=question,
            project_id=project_id,
            top_k=top_k,
        )

        # 2. Convert chunks into LLM context
        context = self.build_context(chunks)

        # 3. Build source information
        sources = self.build_sources(chunks)

        # 4. Generate answer
        answer = self.llm_service.generate_answer(
            question=question,
            context=context,
        )

        # 5. Return final result
        return {
            "answer": answer,
            "sources": sources,
        }