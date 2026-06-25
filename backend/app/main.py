from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .document_loader import DocumentLoaderError, load_text_document
from .rag import (
    EmptyQuestionError,
    EmptyVectorStoreError,
    MissingOpenAIKeyError,
    RAGServiceError,
    VERAService,
)
from .schemas import AskRequest, AskResponse, HealthResponse, UploadResponse


settings = get_settings()
rag_service = VERAService(settings)

app = FastAPI(
    title="VERA API",
    description="Vector Evidence Retrieval Assistant backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="VERA API")


@app.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile | None = File(default=None)) -> UploadResponse:
    try:
        document = await load_text_document(file)
        chunks_indexed = rag_service.index_document(document.filename, document.text)
    except DocumentLoaderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except MissingOpenAIKeyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RAGServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to index the document. Check the backend logs for details.",
        ) from exc

    return UploadResponse(
        filename=document.filename,
        chunks_indexed=chunks_indexed,
        message=f"Indexed {chunks_indexed} chunks from {document.filename}.",
    )


@app.post("/ask", response_model=AskResponse)
async def ask_question(payload: AskRequest) -> AskResponse:
    try:
        result = rag_service.answer_question(payload.question)
    except MissingOpenAIKeyError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except (EmptyQuestionError, EmptyVectorStoreError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to answer the question. Check the backend logs for details.",
        ) from exc

    return AskResponse(**result)
