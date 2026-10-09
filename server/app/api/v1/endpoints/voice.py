from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.schemas.voice import TTSRequest
from app.services.voice_service import synthesize_speech

router = APIRouter()

@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    content_type, audio_stream = await synthesize_speech(
        text=req.text,
        voice=req.voice or "pt-BR-FranciscaNeural",
        rate=req.rate or "+5%",
        pitch=req.pitch or "+15Hz",
        use_rvc=bool(req.use_rvc),
        rvc_pitch=req.rvc_pitch or 0,
        rvc_index_rate=req.rvc_index_rate if req.rvc_index_rate is not None else 0.75,
    )
    return StreamingResponse(audio_stream, media_type=content_type)

