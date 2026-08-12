from sqlalchemy.orm import Session, joinedload

from app.models.document_chunk import DocumentChunk


#joinedlaod is used for the source citation  now Now each chunk can access: chunk.document

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

    def similarity_search(self, query_embedding, project_id: int, top_k: int = 5):
        return (
            self.db.query(DocumentChunk).options(
                joinedload(DocumentChunk.document)
            )
            .join(DocumentChunk.document)
            .filter(DocumentChunk.document.has(project_id=project_id))
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
            .limit(top_k)
            .all()
        )

    
