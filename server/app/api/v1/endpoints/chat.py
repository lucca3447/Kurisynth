from fastapi import APIRouter
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm.orchestrator import orchestrator

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    return await orchestrator.handle_chat(req)
