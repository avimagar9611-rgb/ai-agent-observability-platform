
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.rag_service import (
    DOCUMENTS_DIR,
    ingest_document
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)

# Maximum upload size: 20 MB
MAX_FILE_SIZE = 20 * 1024 * 1024

SUPPORTED_EXTENSIONS = {".pdf", ".txt"}


# ==========================================
# UPLOAD DOCUMENT
# ==========================================

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...)
):
    file_path = None

    try:
        # Validate filename
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="Filename is required."
            )

        # Handle Windows and Unix-style paths safely
        original_name = Path(
            file.filename.replace("\\", "/")
        ).name

        if not original_name:
            raise HTTPException(
                status_code=400,
                detail="Invalid filename."
            )

        # Validate extension
        extension = Path(original_name).suffix.lower()

        if extension not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="Only PDF and TXT files are supported."
            )

        # Create documents directory
        DOCUMENTS_DIR.mkdir(
            parents=True,
            exist_ok=True
        )

        # Generate unique stored filename
        stored_filename = f"{uuid.uuid4().hex}{extension}"
        file_path = DOCUMENTS_DIR / stored_filename

        total_size = 0

        # Save file in chunks to avoid loading the
        # entire upload into memory.
        with file_path.open("wb") as destination:

            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File size cannot exceed 20 MB."
                    )

                destination.write(chunk)

        # Reject empty uploads
        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty."
            )

        # Ingest document into ChromaDB
        result = ingest_document(str(file_path))

        logger.info(
            "Document uploaded successfully: %s",
            stored_filename
        )

        return {
            "message": "Document uploaded and ingested successfully",
            "original_filename": original_name,
            "stored_filename": stored_filename,
            "total_chunks": result["total_chunks"]
        }

    except HTTPException:
        # Preserve expected HTTP errors
        if file_path and file_path.exists():
            file_path.unlink(missing_ok=True)

        raise

    except Exception:
        # Log technical details on the server,
        # but don't expose internal errors to users.
        logger.exception("Document upload or ingestion failed")

        if file_path and file_path.exists():
            try:
                file_path.unlink(missing_ok=True)
            except OSError:
                logger.exception("Could not remove failed upload")

        raise HTTPException(
            status_code=500,
            detail="Document upload or ingestion failed. Please try again."
        )

    finally:
        await file.close()


# ==========================================
# LIST UPLOADED DOCUMENTS
# ==========================================

@router.get("/")
def get_documents():

    try:
        DOCUMENTS_DIR.mkdir(
            parents=True,
            exist_ok=True
        )

        documents = []

        for file_path in DOCUMENTS_DIR.iterdir():

            if (
                file_path.is_file()
                and file_path.suffix.lower() in SUPPORTED_EXTENSIONS
            ):
                documents.append({
                    "filename": file_path.name,
                    "file_type": file_path.suffix.lower(),
                    "size_bytes": file_path.stat().st_size
                })

        # Sort newest filenames first
        documents.sort(
            key=lambda document: document["filename"],
            reverse=True
        )

        return {
            "total_documents": len(documents),
            "documents": documents
        }

    except Exception:
        logger.exception("Could not retrieve uploaded documents")

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve documents."
        )
