import sys
from pathlib import Path
import unittest

SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

from app.schemas.voice import TTSRequest
from app.services.qwen_tts.emotion_mapper import resolve_acoustic_instruct, EMOTION_INSTRUCT_MAP
from app.services.qwen_tts.qwen_manager import QwenTTSManager


def test_tts_request_qwen_fields():
    # Snake case input
    req1 = TTSRequest(text="Não seja idiota, Okabe!", engine="qwen3", emotion="tsundere", instruct="fale rápido")
    assert req1.engine == "qwen3"
    assert req1.emotion == "tsundere"
    assert req1.instruct == "fale rápido"

    # CamelCase input (from frontend JSON)
    req2 = TTSRequest.model_validate({
        "text": "O que você está olhando?",
        "engine": "qwen3",
        "emotion": "flustered",
        "instruct": "voz envergonhada"
    })
    assert req2.engine == "qwen3"
    assert req2.emotion == "flustered"
    assert req2.instruct == "voz envergonhada"


def test_acoustic_instruction_mapper():
    # Test tsundere emotion mapping
    instruct_tsundere = resolve_acoustic_instruct("tsundere")
    assert "Gravação de estúdio cristalina" in instruct_tsundere
    assert "close-mic" in instruct_tsundere
    assert EMOTION_INSTRUCT_MAP["tsundere"] == instruct_tsundere

    # Test unknown emotion fallback
    instruct_default = resolve_acoustic_instruct("unknown_emotion")
    assert "Gravação de estúdio cristalina" in instruct_default
    assert EMOTION_INSTRUCT_MAP["neutral"] == instruct_default

    # Test custom instruct override
    custom = "Sussurrando bem perto do microfone."
    instruct_custom = resolve_acoustic_instruct(custom_instruct=custom)
    assert custom in instruct_custom
    assert "Gravação de estúdio cristalina" in instruct_custom


def test_python_executable_discovery():
    py_exe = QwenTTSManager.get_python_executable()
    assert py_exe is not None
    assert Path(py_exe).exists()
