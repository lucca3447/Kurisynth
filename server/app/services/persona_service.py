import json
from fastapi import HTTPException
from app.core.config import PERSONAS_DIR

def load_persona(persona_id: str) -> dict:
    file_path = PERSONAS_DIR / f"{persona_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Persona '{persona_id}' not found.")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)
