from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")


def _resolve_backend_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return BACKEND_DIR / path


def _read_float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    chroma_db_dir: Path = _resolve_backend_path(os.getenv("CHROMA_DB_DIR", "./chroma_db"))
    chroma_collection_name: str = os.getenv("CHROMA_COLLECTION_NAME", "vera_documents")
    openai_chat_model: str = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
    openai_embedding_model: str = os.getenv(
        "OPENAI_EMBEDDING_MODEL",
        "text-embedding-3-small",
    )
    retrieval_distance_threshold: float = _read_float_env("RELEVANCE_THRESHOLD", 1.40)
    source_display_threshold: float = _read_float_env("SOURCE_DISPLAY_THRESHOLD", 0.47)
    cors_origins: tuple[str, ...] = (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    )


def get_settings() -> Settings:
    return Settings()
