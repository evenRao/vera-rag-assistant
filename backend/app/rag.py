from dataclasses import dataclass, replace
import logging
import re
from uuid import uuid4

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import Settings, get_settings


logger = logging.getLogger(__name__)

NO_EVIDENCE_ANSWER = "I do not have enough evidence in the uploaded documents to answer that."
CHUNK_SIZE = 700
CHUNK_OVERLAP = 120
MAX_RELEVANT_SOURCES = 3
RETRIEVAL_CANDIDATE_COUNT = 8
FALLBACK_DISTANCE_MARGIN = 0.20
MIN_FALLBACK_QUERY_TERM_OVERLAP = 2


@dataclass(frozen=True)
class RetrievalCandidate:
    document: Document
    raw_distance: float
    relevance_score: float
    passed_threshold: bool
    passed_display_threshold: bool
    used_fallback: bool = False


class RAGServiceError(RuntimeError):
    """Base exception for RAG workflow failures."""


class MissingOpenAIKeyError(RAGServiceError):
    """Raised when OPENAI_API_KEY is not configured."""


class EmptyVectorStoreError(RAGServiceError):
    """Raised when a question is asked before any chunks are indexed."""


class EmptyQuestionError(RAGServiceError):
    """Raised when the question is blank."""


class VERAService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._embeddings: OpenAIEmbeddings | None = None
        self._vector_store: Chroma | None = None
        self._last_indexed_filename: str | None = None

    def index_document(self, filename: str, text: str) -> int:
        self._require_openai_api_key()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        chunks = splitter.split_text(text)
        if not chunks:
            raise RAGServiceError("The document could not be split into searchable chunks.")

        documents = [
            Document(
                page_content=chunk,
                metadata={"filename": filename, "chunk_id": index},
            )
            for index, chunk in enumerate(chunks, start=1)
        ]
        ids = [f"{filename}-{index}-{uuid4()}" for index, _ in enumerate(documents, start=1)]

        self._get_vector_store().add_documents(documents=documents, ids=ids)
        self._last_indexed_filename = filename
        return len(documents)

    def answer_question(self, question: str) -> dict[str, object]:
        clean_question = question.strip()
        if not clean_question:
            raise EmptyQuestionError("Question cannot be empty.")

        self._require_openai_api_key()

        vector_store = self._get_vector_store()
        if self._document_count(vector_store) == 0:
            raise EmptyVectorStoreError(
                "No uploaded document has been indexed yet. Upload a .txt or .md file first."
            )

        candidates = self._get_retrieval_candidates(vector_store, clean_question)
        relevant_candidates = self._filter_relevant_candidates(candidates)
        if not relevant_candidates:
            fallback_candidate = self._get_fallback_candidate(candidates, clean_question)
            if fallback_candidate is not None:
                relevant_candidates = [fallback_candidate]

        if not relevant_candidates:
            return {
                "answer": NO_EVIDENCE_ANSWER,
                "sources": [],
                "has_evidence": False,
            }

        context = self._format_context([candidate.document for candidate in relevant_candidates])
        display_candidates = self._filter_display_candidates(relevant_candidates)
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are VERA, a source-grounded document search assistant. "
                    "Answer only using the provided retrieved context. If the retrieved "
                    "context does not contain enough information, say there is not enough "
                    "evidence. Do not guess. Do not use outside knowledge. Keep the answer "
                    "concise and useful. When there is not enough evidence, respond exactly: "
                    f"{NO_EVIDENCE_ANSWER}",
                ),
                (
                    "human",
                    "Question:\n{question}\n\nRetrieved context:\n{context}\n\n"
                    "Write the answer from this context only.",
                ),
            ]
        )

        llm = ChatOpenAI(model=self.settings.openai_chat_model, temperature=0)
        response = llm.invoke(prompt.format_messages(question=clean_question, context=context))
        response_content = getattr(response, "content", str(response))
        answer = response_content if isinstance(response_content, str) else str(response_content)

        return {
            "answer": answer,
            "sources": [
                {
                    "content": candidate.document.page_content,
                    "metadata": {
                        "filename": str(candidate.document.metadata.get("filename", "Unknown")),
                        "chunk_id": int(candidate.document.metadata.get("chunk_id", 0)),
                        "relevance_score": round(candidate.relevance_score, 3),
                    },
                }
                for candidate in display_candidates
            ],
            "has_evidence": True,
        }

    def _require_openai_api_key(self) -> None:
        if not self.settings.openai_api_key:
            raise MissingOpenAIKeyError(
                "OPENAI_API_KEY is not configured. Copy backend/.env.example to "
                "backend/.env and add your OpenAI API key."
            )

    def _get_embeddings(self) -> OpenAIEmbeddings:
        if self._embeddings is None:
            self._embeddings = OpenAIEmbeddings(model=self.settings.openai_embedding_model)
        return self._embeddings

    def _get_vector_store(self) -> Chroma:
        if self._vector_store is None:
            self.settings.chroma_db_dir.mkdir(parents=True, exist_ok=True)
            self._vector_store = Chroma(
                collection_name=self.settings.chroma_collection_name,
                embedding_function=self._get_embeddings(),
                persist_directory=str(self.settings.chroma_db_dir),
            )
        return self._vector_store

    def _get_retrieval_candidates(
        self,
        vector_store: Chroma,
        question: str,
    ) -> list[RetrievalCandidate]:
        docs_with_distances = vector_store.similarity_search_with_score(
            question,
            k=RETRIEVAL_CANDIDATE_COUNT,
        )
        candidates = [
            RetrievalCandidate(
                document=document,
                raw_distance=float(raw_distance),
                relevance_score=self._distance_to_relevance_score(raw_distance),
                passed_threshold=False,
                passed_display_threshold=False,
            )
            for document, raw_distance in docs_with_distances
        ]
        candidates = self._dedupe_candidates(candidates)
        candidates = [
            replace(
                candidate,
                passed_threshold=(
                    candidate.raw_distance <= self.settings.retrieval_distance_threshold
                ),
                passed_display_threshold=(
                    candidate.relevance_score >= self.settings.source_display_threshold
                ),
            )
            for candidate in candidates
        ]
        self._log_retrieval_candidates(question, candidates)
        return candidates

    @staticmethod
    def _dedupe_candidates(
        candidates: list[RetrievalCandidate],
    ) -> list[RetrievalCandidate]:
        deduped_candidates = []
        seen_sources = set()
        for candidate in candidates:
            source_key = (
                candidate.document.metadata.get("filename", "Unknown"),
                candidate.document.metadata.get("chunk_id", "Unknown"),
                candidate.document.page_content,
            )
            if source_key in seen_sources:
                continue

            seen_sources.add(source_key)
            deduped_candidates.append(candidate)

        return deduped_candidates

    def _filter_relevant_candidates(
        self,
        candidates: list[RetrievalCandidate],
    ) -> list[RetrievalCandidate]:
        relevant_candidates = [
            candidate for candidate in candidates if candidate.passed_threshold
        ]
        return sorted(
            relevant_candidates,
            key=lambda candidate: candidate.raw_distance,
        )[:MAX_RELEVANT_SOURCES]

    def _filter_display_candidates(
        self,
        candidates: list[RetrievalCandidate],
    ) -> list[RetrievalCandidate]:
        display_candidates = [
            candidate
            for candidate in candidates
            if candidate.passed_display_threshold
        ]
        return sorted(
            display_candidates,
            key=lambda candidate: candidate.raw_distance,
        )[:MAX_RELEVANT_SOURCES]

    def _get_fallback_candidate(
        self,
        candidates: list[RetrievalCandidate],
        question: str,
    ) -> RetrievalCandidate | None:
        if not candidates or self._last_indexed_filename is None:
            return None

        top_candidate = min(candidates, key=lambda candidate: candidate.raw_distance)
        filename = str(top_candidate.document.metadata.get("filename", ""))
        fallback_threshold = self.settings.retrieval_distance_threshold + FALLBACK_DISTANCE_MARGIN
        if filename != self._last_indexed_filename:
            return None
        if top_candidate.raw_distance > fallback_threshold:
            return None
        if not self._has_query_term_overlap(question, top_candidate.document.page_content):
            return None

        logger.info(
            "retrieval fallback selected question=%r filename=%s chunk_id=%s "
            "raw_distance=%.4f relevance_score=%.3f fallback_distance_threshold=%.3f",
            question,
            filename,
            top_candidate.document.metadata.get("chunk_id", "Unknown"),
            top_candidate.raw_distance,
            top_candidate.relevance_score,
            fallback_threshold,
        )
        return replace(top_candidate, used_fallback=True)

    def _log_retrieval_candidates(
        self,
        question: str,
        candidates: list[RetrievalCandidate],
    ) -> None:
        if not candidates:
            logger.info("retrieval candidates question=%r count=0", question)
            return

        for candidate in candidates:
            logger.info(
                "retrieval candidate question=%r filename=%s chunk_id=%s "
                "raw_distance=%.4f raw_distance_direction=lower_is_more_relevant "
                "relevance_score=%.3f relevance_score_direction=higher_is_more_relevant "
                "distance_threshold=%.3f passed_evidence_threshold=%s "
                "source_display_threshold=%.3f passed_source_display_threshold=%s",
                question,
                candidate.document.metadata.get("filename", "Unknown"),
                candidate.document.metadata.get("chunk_id", "Unknown"),
                candidate.raw_distance,
                candidate.relevance_score,
                self.settings.retrieval_distance_threshold,
                candidate.passed_threshold,
                self.settings.source_display_threshold,
                candidate.passed_display_threshold,
            )

    @staticmethod
    def _document_count(vector_store: Chroma) -> int:
        try:
            return int(vector_store._collection.count())
        except Exception:
            return 0

    @staticmethod
    def _distance_to_relevance_score(distance: float) -> float:
        # Chroma's similarity_search_with_score returns a raw distance:
        # lower distance is more relevant. VERA filters on that raw distance
        # because it separated the side-projects query from unsupported annual
        # revenue queries more reliably in this Chroma/OpenAI setup. The
        # normalized score below is only returned for display/debugging.
        clean_distance = max(float(distance), 0.0)
        return 1.0 / (1.0 + clean_distance)

    @staticmethod
    def _has_query_term_overlap(question: str, content: str) -> bool:
        query_terms = {
            term
            for term in re.findall(r"[a-z0-9]+", question.lower())
            if len(term) >= 4
        }
        if not query_terms:
            return False

        content_terms = set(re.findall(r"[a-z0-9]+", content.lower()))
        return len(query_terms & content_terms) >= MIN_FALLBACK_QUERY_TERM_OVERLAP

    @staticmethod
    def _format_context(documents: list[Document]) -> str:
        formatted_sources = []
        for index, document in enumerate(documents, start=1):
            filename = document.metadata.get("filename", "Unknown")
            chunk_id = document.metadata.get("chunk_id", "Unknown")
            formatted_sources.append(
                f"[Source {index}: {filename}, chunk {chunk_id}]\n{document.page_content}"
            )
        return "\n\n".join(formatted_sources)
