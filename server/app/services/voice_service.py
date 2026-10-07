import re
from typing import AsyncGenerator
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

# Optional Edge-TTS for 100% Free Neural Speech
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False

def check_edge_tts_available() -> bool:
    global EDGE_TTS_AVAILABLE
    if not EDGE_TTS_AVAILABLE:
        try:
            import edge_tts
            EDGE_TTS_AVAILABLE = True
        except ImportError:
            EDGE_TTS_AVAILABLE = False
    return EDGE_TTS_AVAILABLE

def clean_speech_text(text: str) -> str:
    clean_text = re.sub(r"<!--\s*emotion:[^>]*-->", "", text, flags=re.IGNORECASE)
    clean_text = re.sub(r"<!--\s*remember:[^>]*-->", "", clean_text, flags=re.IGNORECASE)
    clean_text = re.sub(r"\*[^*]+\*", "", clean_text)
    clean_text = re.sub(r"[:;]-?[)(DPpOdD]", "", clean_text)
    clean_text = re.sub(r"[*_~`#]", "", clean_text).strip()
    return clean_text

async def generate_edge_tts_stream(text: str, voice: str = "pt-BR-FranciscaNeural", rate: str = "+5%", pitch: str = "+15Hz") -> AsyncGenerator[bytes, None]:
    if not check_edge_tts_available():
        raise HTTPException(
            status_code=503, 
            detail="edge-tts não está instalado. Instale no servidor com: pip install edge-tts"
        )

    clean_text = clean_speech_text(text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="Texto não pode ser vazio para síntese de voz.")

    try:
        communicate = edge_tts.Communicate(
            text=clean_text,
            voice=voice or "pt-BR-FranciscaNeural",
            rate=rate or "+5%",
            pitch=pitch or "+15Hz"
        )

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]
    except Exception as e:
        print(f"[Amadeus Core] Erro na síntese Edge-TTS: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na síntese neural: {str(e)}")
