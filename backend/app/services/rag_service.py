import logging

from app.repositories.chat_message_repository import ChatMessageRepository
from app.repositories.code_graph_repository import CodeGraphRepository
from app.repositories.conversation_repsitory import ConversationRepository
from app.repositories.document_chunk_repository import DocumentChunkRepository
from app.services.document_processing_service import get_processing_service
from app.services.llm_service import LLMService
from app.repositories.project_repository import ProjectRepository

logger = logging.getLogger(__name__)


class RAGService:

    # Mirrors MAX_CONTEXT_CHARS in build_context. Beyond this the graph
    # starts pushing the actual source code out of the model's attention.
    MAX_GRAPH_CHARS = 4000
    MAX_GRAPH_NODES = 6

    def __init__(self, db):
        self.db = db

        self.chunk_repository = DocumentChunkRepository(db)

        self.chat_repository = ChatMessageRepository(db)

        # Shared singleton: this used to rebuild the embedding model
        # on every question asked.
        self.document_processing_service = get_processing_service()
        self.project_repository = ProjectRepository(db)
        self.llm_service = LLMService()
        self.conversation_repository = ConversationRepository(db)
        self.code_graph_repository = CodeGraphRepository()

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

        # 2. Find similar chunks.
        #
        # Over-fetch, because a definition longer than CHUNK_MAX_CHARS is
        # stored as several pieces that all share one code_fqn. Without
        # this, top_k=5 routinely returns 2-3 distinct functions.
        chunks = self.chunk_repository.similarity_search(
            query_embedding=query_embedding,
            project_id=project_id,
            organisation_id=organisation_id,
            top_k=top_k * 3,
        )

        return self.dedupe_by_fqn(chunks, top_k)

    def dedupe_by_fqn(self, chunks, top_k: int):
        """Keep the best-ranked chunk per code_fqn; pass PDF chunks through."""
        deduped = []
        seen = set()

        for chunk in chunks:

            if chunk.code_fqn:

                if chunk.code_fqn in seen:
                    continue

                seen.add(chunk.code_fqn)

            deduped.append(chunk)

            if len(deduped) >= top_k:
                break

        return deduped

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
    # BUILD GRAPH CONTEXT
    # --------------------------------------------------

    def build_graph_context(self, chunks) -> str:
        """
        Render callers/callees for whichever retrieved chunks are code.

        Returns "" for document chunks, so the PDF path is untouched:
        a PDF chunk has code_fqn = None and no code_repository_id.
        """
        targets = []
        seen = set()

        for chunk in chunks:

            document = chunk.document

            if not chunk.code_fqn or not document:
                continue

            repository_id = document.code_repository_id

            if not repository_id:
                continue

            key = (repository_id, chunk.code_fqn)

            if key in seen:
                continue

            seen.add(key)
            targets.append(key)

        if not targets:
            return ""

        parts = []
        total_chars = 0

        for repository_id, fqn in targets[: self.MAX_GRAPH_NODES]:

            try:
                result = self.code_graph_repository.get_neighbours(
                    repository_id,
                    fqn,
                )
            except Exception as exc:
                # A graph outage must degrade to plain RAG, never 500.
                logger.warning("Graph lookup failed for %s: %s", fqn, exc)
                return ""

            if not result:
                continue

            node = result["node"]

            block = [
                f"### {node['fqn']}",
                (
                    f"defined in: {node['file_path']}:"
                    f"{node['start_line']}-{node['end_line']}"
                ),
            ]

            if node.get("signature"):
                block.append(f"signature:  {node['signature']}")

            if result["parent"]:
                block.append(f"defined by: {result['parent']}")

            if result["bases"]:
                block.append(f"inherits:   {', '.join(result['bases'])}")

            # The explicit "(none found)" wording matters: an omitted
            # line reads as dead code, but the resolver drops ambiguous
            # calls and never sees decorators or dynamic dispatch.
            block.append(
                f"called by:  {', '.join(result['callers'])}"
                if result["callers"]
                else "called by:  (none found in the graph)"
            )

            block.append(
                f"calls:      {', '.join(result['callees'])}"
                if result["callees"]
                else "calls:      (none found in the graph)"
            )

            text = "\n".join(block)

            if total_chars + len(text) > self.MAX_GRAPH_CHARS:
                break

            parts.append(text)
            total_chars += len(text)

        return "\n\n".join(parts)

    # --------------------------------------------------
    # BUILD SOURCES
    # --------------------------------------------------

    def build_sources(self, chunks):

        sources = []

        for chunk in chunks:

            document = chunk.document

            source = {
                "document_id": chunk.document_id,
                "chunk_id": chunk.id,
                "document_name": (
                    document.name if document else "Unknown document"
                ),
                "chunk_index": chunk.chunk_index,
            }

            # chunk_index is meaningless for code: cite file:line instead.
            if chunk.code_fqn:
                source["code_fqn"] = chunk.code_fqn
                source["file_path"] = document.file_path if document else None
                source["start_line"] = chunk.start_line
                source["end_line"] = chunk.end_line

            sources.append(source)

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

        # 6b. Expand the retrieved code with its graph neighbours

        graph_context = self.build_graph_context(chunks)

        # 7. Generate answer
        #
        # Branch on the graph context rather than on a mode flag, so a
        # project holding both PDFs and code routes per question.

        if graph_context:
            answer = self.llm_service.generate_code_answer(
                question=question,
                context=context,
                graph_context=graph_context,
                chat_history=chat_history,
            )
        else:
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
