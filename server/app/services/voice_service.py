import io
import re
from typing import AsyncGenerator, Tuple, Union
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

# Optional Edge-TTS for 100% Free Neural Speech
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False

from app.services.rvc.rvc_manager import RVCManager


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


async def generate_edge_tts_stream(
    text: str,
    voice: str = "pt-BR-FranciscaNeural",
    rate: str = "+5%",
    pitch: str = "+15Hz",
) -> AsyncGenerator[bytes, None]:
    if not check_edge_tts_available():
        raise HTTPException(
            status_code=503,
            detail="edge-tts não está instalado. Instale no servidor com: pip install edge-tts",
        )

    clean_text = clean_speech_text(text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="Texto não pode ser vazio para síntese de voz.")

    try:
        communicate = edge_tts.Communicate(
            text=clean_text,
            voice=voice or "pt-BR-FranciscaNeural",
            rate=rate or "+5%",
            pitch=pitch or "+15Hz",
        )

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]
    except Exception as e:
        print(f"[Amadeus Core] Erro na síntese Edge-TTS: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na síntese neural: {str(e)}")


async def synthesize_speech(
    text: str,
    voice: str = "pt-BR-FranciscaNeural",
    rate: str = "+5%",
    pitch: str = "+15Hz",
    use_rvc: bool = False,
    rvc_pitch: int = 0,
    rvc_index_rate: float = 0.75,
) -> Tuple[str, AsyncGenerator[bytes, None]]:
    """
    Synthesizes speech:
    1. If use_rvc is False, streams Edge-TTS audio directly (audio/mpeg).
    2. If use_rvc is True, converts Edge-TTS output using the Kurisu RVC Neural Worker
       into Makise Kurisu's cloned voice (audio/wav).
    3. If RVC conversion fails, transparently falls back to Edge-TTS.
    """
    if not use_rvc:
        return "audio/mpeg", generate_edge_tts_stream(text, voice=voice, rate=rate, pitch=pitch)

    # 1. Collect Edge-TTS audio chunks
    edge_chunks = []
    async for chunk in generate_edge_tts_stream(text, voice=voice, rate=rate, pitch=pitch):
        edge_chunks.append(chunk)

    edge_audio_bytes = b"".join(edge_chunks)
    if not edge_audio_bytes:
        raise HTTPException(status_code=500, detail="Falha ao gerar áudio base para conversão RVC.")

    # 2. Attempt RVC conversion
    try:
        converted_wav = await RVCManager.convert(
            audio_bytes=edge_audio_bytes,
            pitch_shift=rvc_pitch,
            index_rate=rvc_index_rate,
        )
        if converted_wav:
            async def _wav_gen():
                yield converted_wav
            return "audio/wav", _wav_gen()
        else:
            print("[Amadeus Voice] Fallback: RVC retorno vazio/erro, reproduzindo Edge-TTS original.")
    except Exception as err:
        print(f"[Amadeus Voice] Falha na conversão RVC, executando fallback transparente: {err}")

    # Fallback to base Edge-TTS
    async def _fallback_gen():
        yield edge_audio_bytes

    return "audio/mpeg", _fallback_gen()
