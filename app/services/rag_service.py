
import hashlib
from functools import lru_cache
from pathlib import Path

from pypdf import PdfReader


# ==========================================
# CONFIGURATION
# ==========================================

APP_DIR = Path(__file__).resolve().parents[1]

DOCUMENTS_DIR = APP_DIR / "data" / "documents"
CHROMA_DIR = APP_DIR / "data" / "chroma_db"

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
COLLECTION_NAME = "agentwatch_documents"

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150

TOP_K = 3
MAX_DISTANCE = 0.75

DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)


# ==========================================
# INPUT VALIDATION
# ==========================================

def validate_text(value, field_name):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must be a non-empty string.")


def validate_top_k(top_k):
    if isinstance(top_k, bool) or not isinstance(top_k, int) or top_k < 1:
        raise ValueError("top_k must be a positive integer.")


# ==========================================
# EMBEDDING MODEL
# ==========================================

@lru_cache(maxsize=1)
def get_embedding_model():
    # Load only when embeddings are actually needed.
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(EMBEDDING_MODEL)


# ==========================================
# CHROMADB CONNECTION
# ==========================================

@lru_cache(maxsize=1)
def get_collection():
    # Load ChromaDB only when document storage/retrieval is needed.
    import chromadb

    client = chromadb.PersistentClient(
        path=str(CHROMA_DIR)
    )

    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )


# ==========================================
# LOAD DOCUMENT
# ==========================================

def load_document(file_path):

    file_path = Path(file_path)

    if not file_path.exists() or not file_path.is_file():
        raise FileNotFoundError("Document file does not exist.")

    extension = file_path.suffix.lower()

    if extension == ".txt":

        text = file_path.read_text(encoding="utf-8")

    elif extension == ".pdf":

        pdf = PdfReader(str(file_path))

        pages = []

        for page in pdf.pages:
            page_text = page.extract_text()

            if page_text:
                pages.append(page_text)

        text = "\n".join(pages)

    else:
        raise ValueError("Only PDF and TXT files are supported.")

    if not text.strip():
        raise ValueError(
            "The document contains no extractable text."
        )

    return text


# ==========================================
# SPLIT DOCUMENT INTO CHUNKS
# ==========================================

def split_into_chunks(
    text,
    chunk_size=CHUNK_SIZE,
    overlap=CHUNK_OVERLAP
):

    validate_text(text, "Document text")

    if isinstance(chunk_size, bool) or not isinstance(chunk_size, int):
        raise ValueError("chunk_size must be an integer.")

    if isinstance(overlap, bool) or not isinstance(overlap, int):
        raise ValueError("overlap must be an integer.")

    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero.")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError(
            "overlap must be non-negative and smaller than chunk_size."
        )

    text = text.strip()
    chunks = []

    start = 0
    step = chunk_size - overlap

    while start < len(text):

        end = start + chunk_size
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        start += step

    return chunks


# ==========================================
# GENERATE EMBEDDINGS
# ==========================================

def generate_embeddings(texts):

    if not isinstance(texts, list) or not texts:
        raise ValueError("Texts must be a non-empty list.")

    for item in texts:
        validate_text(item, "Embedding text")

    model = get_embedding_model()

    embeddings = model.encode(
        texts,
        show_progress_bar=False
    )

    return embeddings.tolist()


# ==========================================
# INGEST DOCUMENT INTO CHROMADB
# ==========================================

def ingest_document(file_path):

    file_path = Path(file_path)

    # Read document
    text = load_document(file_path)

    # Split document
    chunks = split_into_chunks(text)

    if not chunks:
        raise ValueError("No text chunks were generated.")

    # Generate embeddings
    embeddings = generate_embeddings(chunks)

    # Generate content-based IDs
    document_hash = hashlib.sha256(
        text.encode("utf-8")
    ).hexdigest()

    ids = [
        f"{document_hash}_{index}"
        for index in range(len(chunks))
    ]

    # Prepare metadata
    metadatas = [
        {
            "source": file_path.name,
            "chunk_index": index
        }
        for index in range(len(chunks))
    ]

    # Store in ChromaDB
    collection = get_collection()

    collection.upsert(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas
    )

    return {
        "total_chunks": len(chunks),
        "source": file_path.name
    }


# ==========================================
# RETRIEVE RELEVANT DOCUMENT CHUNKS
# ==========================================

def retrieve_relevant_chunks(
    query,
    top_k=TOP_K
):

    validate_text(query, "Query")
    validate_top_k(top_k)

    collection = get_collection()

    total_documents = collection.count()

    if total_documents == 0:
        return []

    model = get_embedding_model()

    query_embedding = model.encode(
        query
    ).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, total_documents),
        include=[
            "documents",
            "metadatas",
            "distances"
        ]
    )

    documents = (results.get("documents") or [[]])[0] or []
    metadatas = (results.get("metadatas") or [[]])[0] or []
    distances = (results.get("distances") or [[]])[0] or []

    retrieved_chunks = []

    for chunk_text, metadata, distance in zip(
        documents,
        metadatas,
        distances
    ):

        if not isinstance(chunk_text, str) or not chunk_text.strip():
            continue

        if not isinstance(metadata, dict):
            metadata = {}

        if distance is None or distance > MAX_DISTANCE:
            continue

        retrieved_chunks.append({
            "text": chunk_text,
            "source": metadata.get("source", "Unknown"),
            "chunk_index": metadata.get("chunk_index", 0),
            "distance": float(distance)
        })

    return retrieved_chunks


# ==========================================
# BUILD CONTEXT FOR THE LLM
# ==========================================

def build_context(query, top_k=TOP_K):

    retrieved_chunks = retrieve_relevant_chunks(
        query,
        top_k
    )

    if not retrieved_chunks:
        return ""

    return "\n\n".join(
        chunk["text"]
        for chunk in retrieved_chunks
    )
