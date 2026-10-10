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
from app.services.qwen_tts.qwen_manager import QwenTTSManager


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
    engine: str = "edge_rvc",
    emotion: Optional[str] = None,
    instruct: Optional[str] = None,
) -> Tuple[str, AsyncGenerator[bytes, None]]:
    """
    Synthesizes speech:
    1. If engine == "qwen3": synthesizes directly in Makise Kurisu's voice using
       resident Qwen3-TTS neural worker. Falls back to Edge-TTS+RVC if offline.
    2. If engine == "edge_rvc" and use_rvc is False, streams Edge-TTS audio directly (audio/mpeg).
    3. If engine == "edge_rvc" and use_rvc is True, converts Edge-TTS output using the Kurisu RVC Neural Worker
       into Makise Kurisu's cloned voice (audio/wav).
    4. If conversion/Qwen fails, transparently falls back to Edge-TTS.
    """
    clean_text = clean_speech_text(text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="Texto não pode ser vazio para síntese de voz.")

    # 1. Qwen3-TTS Direct Neural Path
    if engine == "qwen3":
        try:
            qwen_wav = await QwenTTSManager.synthesize(
                text=clean_text,
                emotion=emotion,
                custom_instruct=instruct,
                language="Portuguese",
            )
            if qwen_wav:
                async def _qwen_gen():
                    yield qwen_wav
                return "audio/wav", _qwen_gen()
            print("[Amadeus Voice] Qwen3 indisponível ou falhou; fallback automático para Edge-TTS + RVC.")
        except Exception as e:
            print(f"[Amadeus Voice] Erro no Qwen3-TTS: {e}; chaveando para fallback Edge-TTS + RVC.")
        
        # Fallback to RVC if Qwen is requested but fails
        use_rvc = True

    # 2. Direct Edge-TTS (No RVC)
    if not use_rvc:
        return "audio/mpeg", generate_edge_tts_stream(clean_text, voice=voice, rate=rate, pitch=pitch)

    # 3. Collect Edge-TTS audio chunks for RVC conversion
    edge_chunks = []
    async for chunk in generate_edge_tts_stream(clean_text, voice=voice, rate=rate, pitch=pitch):
        edge_chunks.append(chunk)

    edge_audio_bytes = b"".join(edge_chunks)
    if not edge_audio_bytes:
        raise HTTPException(status_code=500, detail="Falha ao gerar áudio base para conversão RVC.")

    # 4. Attempt RVC conversion
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

    # 5. Final fallback to base Edge-TTS
    async def _fallback_gen():
        yield edge_audio_bytes

    return "audio/mpeg", _fallback_gen()

