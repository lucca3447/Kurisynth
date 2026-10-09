import sys
from pathlib import Path
import pytest

SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

from app.schemas.voice import TTSRequest
from app.services.rvc.rvc_manager import RVCManager



def test_tts_request_rvc_fields():
    # Test snake_case inputs
    req1 = TTSRequest(text="Olá Okabe", use_rvc=True, rvc_pitch=2, rvc_index_rate=0.85)
    assert req1.use_rvc is True
    assert req1.rvc_pitch == 2
    assert req1.rvc_index_rate == 0.85

    # Test camelCase inputs (from frontend JSON)
    req2 = TTSRequest.model_validate({
        "text": "Baka!",
        "useRvc": True,
        "rvcPitch": -1,
        "rvcIndexRate": 0.6
    })
    assert req2.use_rvc is True
    assert req2.rvc_pitch == -1
    assert req2.rvc_index_rate == 0.6


import asyncio

def test_rvc_manager_offline_fallback():
    # When worker is offline, convert should return None cleanly without crashing
    result = asyncio.run(RVCManager.convert(b"fake_wav_data", pitch_shift=0, index_rate=0.75))
    assert result is None

