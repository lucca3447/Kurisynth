import sys
import asyncio
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

from app.schemas.voice import TTSRequest, QwenPingRequest
from app.services.qwen_tts.emotion_mapper import resolve_acoustic_instruct, EMOTION_INSTRUCT_MAP
from app.services.qwen_tts.qwen_manager import QwenTTSManager


class TestQwenTTS(unittest.TestCase):
    def test_tts_request_qwen_fields(self):
        # Snake case input
        req1 = TTSRequest(
            text="Não seja idiota, Okabe!",
            engine="qwen3",
            emotion="tsundere",
            instruct="fale rápido",
            qwen_mode="remote",
            qwen_remote_url="https://amadeus-tts.trycloudflare.com",
            rvc_model="KurisuRVCv147",
        )
        self.assertEqual(req1.engine, "qwen3")
        self.assertEqual(req1.emotion, "tsundere")
        self.assertEqual(req1.instruct, "fale rápido")
        self.assertEqual(req1.qwen_mode, "remote")
        self.assertEqual(req1.qwen_remote_url, "https://amadeus-tts.trycloudflare.com")
        self.assertEqual(req1.rvc_model, "KurisuRVCv147")
        self.assertFalse(req1.stream)

        # CamelCase input (from frontend JSON)
        req2 = TTSRequest.model_validate({
            "text": "O que você está olhando?",
            "engine": "qwen3",
            "emotion": "flustered",
            "instruct": "voz envergonhada",
            "qwenMode": "local",
            "qwenRemoteUrl": "http://127.0.0.1:8005",
            "rvcModel": "KurisuRVCv147",
            "stream": True,
        })
        self.assertEqual(req2.engine, "qwen3")
        self.assertEqual(req2.emotion, "flustered")
        self.assertEqual(req2.instruct, "voz envergonhada")
        self.assertEqual(req2.qwen_mode, "local")
        self.assertEqual(req2.qwen_remote_url, "http://127.0.0.1:8005")
        self.assertTrue(req2.stream)

    def test_acoustic_instruction_mapper(self):
        # Test tsundere instruction returns English calibrated prompt
        instruct_tsundere = resolve_acoustic_instruct("tsundere")
        self.assertIsNotNone(instruct_tsundere)
        self.assertIn("Mid pitch", instruct_tsundere)
        self.assertIn("defensive", instruct_tsundere)

        # Test smile instruction returns refined non-contradictory prompt
        instruct_smile = resolve_acoustic_instruct("smile")
        self.assertIsNotNone(instruct_smile)
        self.assertIn("subtle smile", instruct_smile)
        self.assertIn("slightly amused", instruct_smile)
        self.assertNotIn("gentle and warm", instruct_smile)
        self.assertNotIn("friendly", instruct_smile)

        # Test neutral emotion returns None to let pre-trained weights dominate
        instruct_neutral = resolve_acoustic_instruct("neutral")
        self.assertIsNone(instruct_neutral)

        # Test unknown emotion fallback (None for natural voice)
        instruct_default = resolve_acoustic_instruct("unknown_emotion")
        self.assertIsNone(instruct_default)

        # Test custom instruct override
        custom = "Sussurrando bem perto do microfone."
        instruct_custom = resolve_acoustic_instruct(custom_instruct=custom)
        self.assertEqual(custom, instruct_custom)

        # Test full 21 emotion mapping completeness and pitch anchoring (NO high pitch)
        from app.services.qwen_tts.emotion_mapper import EMOTION_ACOUSTIC_TARGETS
        from app.services.emotion_service import VALID_EMOTIONS
        self.assertEqual(len(EMOTION_INSTRUCT_MAP), 21)
        self.assertEqual(len(EMOTION_ACOUSTIC_TARGETS), 21)
        self.assertEqual(len(VALID_EMOTIONS), 21)
        self.assertEqual(set(EMOTION_INSTRUCT_MAP.keys()), set(VALID_EMOTIONS))

        for emo, prompt in EMOTION_INSTRUCT_MAP.items():
            self.assertIn(emo, EMOTION_ACOUSTIC_TARGETS)
            if prompt is not None:
                # Ensure no prompts contain high pitch (prevents >500Hz screeching)
                self.assertNotIn("high pitch", prompt.lower())
                self.assertTrue(prompt.startswith("Mid") or prompt.startswith("Low"))

    def test_clean_text_for_tts(self):
        from app.services.voice_service import clean_text_for_tts

        # Interrobangs replaced by ?
        raw1 = "O que você disse?! Não pode ser!? Sério?!!"
        self.assertEqual(clean_text_for_tts(raw1), "O que você disse? Não pode ser? Sério?")

        # Multiple exclamation marks reduced to single emphatic !
        raw2 = "Idiota!! Cale a boca!!!"
        self.assertEqual(clean_text_for_tts(raw2), "Idiota! Cale a boca!")

        # Unicode horizontal ellipsis normalized to ASCII ... and preserved mid-sentence
        raw_cut = "U... um, quem… não sei se devo acreditar nesse elogio vindo de alguém que ainda me chama de… mas, se está me dizendo isso..."
        cleaned_cut = clean_text_for_tts(raw_cut)
        self.assertNotIn("…", cleaned_cut)
        self.assertTrue(cleaned_cut.startswith("Hum, quem... não sei"))
        self.assertIn("chama de... mas", cleaned_cut)

        # Hesitation vocables and anime sighs/stutters (U-um, Uhm, Hmm) sanitized to articulate Hum
        raw_stutter = "U-um... não sei! Uhm, quem você pensa que é? Hmm... espere."
        cleaned_stutter = clean_text_for_tts(raw_stutter)
        self.assertNotIn("U-um", cleaned_stutter)
        self.assertNotIn("Uhm", cleaned_stutter)
        self.assertNotIn("Hmm", cleaned_stutter)
        self.assertIn("Hum... não sei!", cleaned_stutter)
        self.assertIn("Hum, quem", cleaned_stutter)
        self.assertIn("Hum... espere.", cleaned_stutter)

        # Single-letter prefix stutters (Q-quem, L-linda, N-não, M-mas) cleaned cleanly
        raw_letters = "Q-quem?! L-linda?! N-não me diga que você acha isso... M-mas espere!"
        cleaned_letters = clean_text_for_tts(raw_letters)
        self.assertEqual(cleaned_letters, "Quem? Linda? Não me diga que você acha isso... Mas espere!")

    def test_python_executable_discovery(self):
        py_exe = QwenTTSManager.get_python_executable()
        self.assertIsNotNone(py_exe)
        self.assertTrue(Path(py_exe).exists())

    def test_resolve_target_url(self):
        # Explicit remote URL provided
        custom_url = "https://test-worker.trycloudflare.com/"
        resolved = QwenTTSManager.resolve_target_url(qwen_mode="remote", custom_url=custom_url)
        self.assertEqual(resolved, "https://test-worker.trycloudflare.com")
        self.assertTrue(QwenTTSManager.is_remote_url(resolved))

        # Local loopback default
        local_resolved = QwenTTSManager.resolve_target_url(qwen_mode="local", custom_url=None)
        self.assertEqual(local_resolved, "http://127.0.0.1:8005")
        self.assertFalse(QwenTTSManager.is_remote_url(local_resolved))

    def test_apply_boundary_continuity(self):
        from app.services.qwen_tts.qwen_worker import apply_boundary_continuity
        import numpy as np

        # Previous chunk ended with amplitude 0.25
        prev_sample = 0.25
        # Current chunk starts with amplitude 0.10 (an abrupt 0.15 jump)
        chunk = np.ones(300, dtype=np.float32) * 0.10

        smoothed = apply_boundary_continuity(chunk, prev_sample)

        # Sample 0 must match prev_sample exactly (C0 continuity)
        self.assertAlmostEqual(float(smoothed[0]), prev_sample, places=5)
        # Sample 119 should be almost back to original chunk value
        self.assertAlmostEqual(float(smoothed[119]), 0.10, places=4)
        # Sample 120+ should be completely untouched
        self.assertEqual(smoothed[120], chunk[120])
        self.assertEqual(smoothed[299], chunk[299])

        # None prev_sample should leave chunk unchanged
        unchanged = apply_boundary_continuity(chunk, None)
        np.testing.assert_array_equal(unchanged, chunk)


if __name__ == "__main__":
    unittest.main()
