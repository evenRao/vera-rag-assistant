from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str


class UploadResponse(BaseModel):
    filename: str
    chunks_indexed: int
    message: str


class AskRequest(BaseModel):
    question: str = Field(..., description="Question to answer from uploaded documents.")


class SourceMetadata(BaseModel):
    filename: str
    chunk_id: int
    relevance_score: float | None = None


class SourceSnippet(BaseModel):
    content: str
    metadata: SourceMetadata


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceSnippet]
    has_evidence: bool
