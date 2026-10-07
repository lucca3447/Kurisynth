from fastapi import APIRouter
from app.services.persona_service import load_persona

router = APIRouter()

@router.get("/personas/{persona_id}")
def get_persona(persona_id: str):
    return load_persona(persona_id)
