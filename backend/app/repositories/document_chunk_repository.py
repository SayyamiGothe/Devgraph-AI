from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.project import Project
from app.models.workspaces import Workspace

# joinedlaod is used for the source citation  now Now each chunk can access: chunk.document


class DocumentChunkRepository:

    def __init__(self, db: Session):
        self.db = db

    def create_chunks(
        self,
        document_id: int,
        chunks,
        embeddings,
    ):
        document_chunks = []

        for index, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            document_chunk = DocumentChunk(
                document_id=document_id,
                chunk_text=chunk.page_content,
                chunk_index=index,
                embedding=embedding,
            )

            document_chunks.append(document_chunk)

        self.db.add_all(document_chunks)
        self.db.commit()

        return document_chunk

    # Lower distance = more similar
    # Higher distance = less similar

    # only accept distance <= 0.40

    def similarity_search(
        self,
        query_embedding,
        project_id: int,
        organisation_id: int,
        top_k: int = 5,
    ):
        return (
            self.db.query(DocumentChunk)
            .join(
                Document,
                Document.id == DocumentChunk.document_id,
            )
            .join(
                Project,
                Project.id == Document.project_id,
            )
            # `Project.organisation_id` is a Python property, not a column —
            # comparing it in a filter compiles to `WHERE false` and returns
            # nothing, so the organisation is matched on the workspace instead.
            .join(
                Workspace,
                Workspace.id == Project.workspaces_id,
            )
            .filter(
                Project.id == project_id,
                Workspace.organisation_id == organisation_id,
            )
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
            .limit(top_k)
            .all()
        )

    def keyword_search(
        self,
        query: str,
        project_id: int,
        top_k: int = 5,
    ):
        # PostgreSQL turns the natural-language query into a text-search query.
        search_query = func.plainto_tsquery(
            "english",
            query,
        )
        # What ts_rank() does
        # calculates how relevant the chunk is to the query.
        rank = func.ts_rank(
            DocumentChunk.search_vector,
            search_query,
        )

        results = (
            self.db.query(
                DocumentChunk,
                rank.label("rank"),
            )
            .join(DocumentChunk.document)
            .filter(Document.project_id == project_id)
            .filter(
                #    What @@ means
                # Does this document's search vector
                # match the search query?
                DocumentChunk.search_vector.op("@@")(search_query)
            )
            .order_by(rank.desc())
            .limit(top_k)
            .all()
        )

        return results

    def hybrid_search(
        self,
        query: str,
        query_embedding,
        project_id: int,
        organisation_id: int,
        top_k: int = 5,
    ):

        vector_results = self.similarity_search(
            query_embedding=query_embedding,
            project_id=project_id,
            organisation_id=organisation_id,
            top_k=top_k,
        )

        keyword_results = self.keyword_search(
            query=query,
            project_id=project_id,
            top_k=top_k,
        )

        combined = []

        seen_ids = set()

        for chunk in vector_results + keyword_results:

            if chunk.id not in seen_ids:

                combined.append(chunk)

                seen_ids.add(chunk.id)

        return combined[:top_k]
