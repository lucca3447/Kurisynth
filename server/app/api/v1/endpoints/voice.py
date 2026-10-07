from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.schemas.voice import TTSRequest
from app.services.voice_service import generate_edge_tts_stream

router = APIRouter()

@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    audio_stream = generate_edge_tts_stream(
        text=req.text,
        voice=req.voice or "pt-BR-FranciscaNeural",
        rate=req.rate or "+5%",
        pitch=req.pitch or "+15Hz"
    )
    return StreamingResponse(audio_stream, media_type="audio/mpeg")
