from fastapi import APIRouter
from app.db.memory_store import memory_store
from app.services.voice_service import check_edge_tts_available
from app.core.config import APP_VERSION

router = APIRouter()

@router.get("/health")
def health():
    return {
        "status": "online",
        "system": f"AMADEUS OS v{APP_VERSION}",
        "database": "SQLite (amadeus.db)",
        "vectorStore": "ChromaDB (./data/memory_db)",
        "chromaCount": memory_store.collection.count(),
        "exemplarsCount": memory_store.exemplars_collection.count(),
        "totalMemories": len(memory_store.get_all_memories()),
        "totalSessions": len(memory_store.list_sessions()),
        "edgeTtsAvailable": check_edge_tts_available()
    }
