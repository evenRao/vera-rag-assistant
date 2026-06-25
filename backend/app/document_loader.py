from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile


SUPPORTED_EXTENSIONS = {".txt", ".md"}


class DocumentLoaderError(ValueError):
    """Raised when an uploaded document cannot be loaded."""


@dataclass(frozen=True)
class LoadedDocument:
    filename: str
    text: str


async def load_text_document(file: UploadFile | None) -> LoadedDocument:
    if file is None:
        raise DocumentLoaderError("No uploaded document was provided.")

    filename = Path(file.filename or "").name
    if not filename:
        raise DocumentLoaderError("No uploaded document was provided.")

    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise DocumentLoaderError("Unsupported file type. Upload a .txt or .md document.")

    raw_content = await file.read()
    if not raw_content:
        raise DocumentLoaderError("The uploaded document is empty.")

    try:
        text = raw_content.decode("utf-8")
    except UnicodeDecodeError:
        text = raw_content.decode("utf-8", errors="ignore")

    text = text.strip()
    if not text:
        raise DocumentLoaderError("The uploaded document does not contain readable text.")

    return LoadedDocument(filename=filename, text=text)
