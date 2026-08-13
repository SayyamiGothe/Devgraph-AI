from app.repositories.chat_message_repository import ChatMessageRepository
from app.repositories.conversation_repsitory import ConversationRepository
from app.repositories.document_chunk_repository import DocumentChunkRepository
from app.services.document_processing_service import DocumentProcessingService
from app.services.llm_service import LLMService
from app.repositories.project_repository import ProjectRepository


class RAGService:

    def __init__(self, db):
        self.db = db

        self.chunk_repository = DocumentChunkRepository(db)

        self.chat_repository = ChatMessageRepository(db)

        self.document_processing_service = DocumentProcessingService()
        self.project_repository = ProjectRepository(db)
        self.llm_service = LLMService()
        self.conversation_repository = ConversationRepository(db)

    # --------------------------------------------------
    # RETRIEVE RELEVANT CHUNKS
    # --------------------------------------------------

    def retrieve(
        self,
        question: str,
        project_id: int,
        organisation_id: int,
        top_k: int = 5,
    ):

        # 1. Convert question into embedding
        query_embedding = self.document_processing_service.generate_query_embedding(
            question
        )

        # 2. Find similar chunks
        chunks = self.chunk_repository.similarity_search(
            query_embedding=query_embedding,
            project_id=project_id,
            organisation_id=organisation_id,
            top_k=top_k,
        )

        return chunks

    # --------------------------------------------------
    # BUILD CONTEXT
    # --------------------------------------------------

    def build_context(self, chunks):

        context_parts = []
        seen_chunks = set()
        total_chars = 0
        MAX_CONTEXT_CHARS = 12000

        for chunk in chunks:

            if chunk.id in seen_chunks:
                continue

            seen_chunks.add(chunk.id)

            document_name = (
                chunk.document.name if chunk.document else "Unknown document"
            )

            chunk_text = (
                f"Source: {document_name}\n"
                f"Chunk: {chunk.chunk_index}\n\n"
                f"{chunk.chunk_text}"
            )

            if total_chars + len(chunk_text) > MAX_CONTEXT_CHARS:
                break

            context_parts.append(chunk_text)

            total_chars += len(chunk_text)

        return "\n\n".join(context_parts)

    # --------------------------------------------------
    # BUILD SOURCES
    # --------------------------------------------------

    def build_sources(self, chunks):

        sources = []

        for chunk in chunks:

            sources.append(
                {
                    "document_id": chunk.document_id,
                    "chunk_id": chunk.id,
                    "document_name": (
                        chunk.document.name if chunk.document else "Unknown document"
                    ),
                    "chunk_index": chunk.chunk_index,
                }
            )

        return sources

    # --------------------------------------------------
    # GET CHAT HISTORY
    # --------------------------------------------------

    def get_chat_history(
        self,
        conversation_id: int,
    ):

        messages = self.chat_repository.get_messages(
            conversation_id=conversation_id,
            limit=10,
        )

        # Repository returns newest first.
        # LLM needs oldest -> newest.
        messages.reverse()

        return messages

    # --------------------------------------------------
    # BUILD CHAT HISTORY FOR LLM
    # --------------------------------------------------

    def build_chat_history(self, messages):

        if not messages:
            return ""

        history_parts = []

        for message in messages:

            history_parts.append(f"{message.role}: {message.content}")

        return "\n".join(history_parts)

    # --------------------------------------------------
    # ANSWER QUESTION
    # --------------------------------------------------

    def answer_question(
        self,
        question: str,
        project_id: int,
        conversation_id: int,
        organisation_id: int,
        top_k: int = 5,
    ):

        # ----------------------------------------------
        # 1. Get previous conversation
        # ----------------------------------------------

        history = self.get_chat_history(conversation_id=conversation_id)

        # 2. Convert history into text

        chat_history = self.build_chat_history(history)

        # 3. Save current user question

        self.chat_repository.create_message(
            conversation_id=conversation_id,
            role="user",
            content=question,
        )

        # 4. Retrieve relevant chunks

        chunks = self.retrieve(
            question=question,
            project_id=project_id,
            organisation_id=organisation_id,
            top_k=top_k,
        )

        if not chunks:

            answer = (
                "I couldn't find relevant information " "in the uploaded documents."
            )

            self.chat_repository.create_message(
                conversation_id=conversation_id,
                role="assistant",
                content=answer,
            )

            return {
                "answer": answer,
                "sources": [],
            }

        # 5. Convert chunks into LLM context

        context = self.build_context(chunks)

        # 6. Build source information

        sources = self.build_sources(chunks)

        # 7. Generate answer

        answer = self.llm_service.generate_answer(
            question=question,
            context=context,
            chat_history=chat_history,
        )

        # 8. Save assistant response

        self.chat_repository.create_message(
            conversation_id=conversation_id,
            role="assistant",
            content=answer,
        )

        # ----------------------------------------------
        # 9. Return result
        # ----------------------------------------------

        return {
            "answer": answer,
            "sources": sources,
        }

    def calculate_vector_score(self, distance):
        return 1 - distance
