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

        # CamelCase input (from frontend JSON)
        req2 = TTSRequest.model_validate({
            "text": "O que você está olhando?",
            "engine": "qwen3",
            "emotion": "flustered",
            "instruct": "voz envergonhada",
            "qwenMode": "local",
            "qwenRemoteUrl": "http://127.0.0.1:8005",
            "rvcModel": "KurisuRVCv147",
        })
        self.assertEqual(req2.engine, "qwen3")
        self.assertEqual(req2.emotion, "flustered")
        self.assertEqual(req2.instruct, "voz envergonhada")
        self.assertEqual(req2.qwen_mode, "local")
        self.assertEqual(req2.qwen_remote_url, "http://127.0.0.1:8005")

    def test_acoustic_instruction_mapper(self):
        # Test tsundere emotion mapping
        instruct_tsundere = resolve_acoustic_instruct("tsundere")
        self.assertIn("som seco e direto sem eco", instruct_tsundere)
        self.assertIn("Tom tsundere", instruct_tsundere)
        self.assertEqual(EMOTION_INSTRUCT_MAP["tsundere"], instruct_tsundere)

        # Test unknown emotion fallback
        instruct_default = resolve_acoustic_instruct("unknown_emotion")
        self.assertIn("som seco e direto sem eco", instruct_default)
        self.assertEqual(EMOTION_INSTRUCT_MAP["neutral"], instruct_default)

        # Test custom instruct override
        custom = "Sussurrando bem perto do microfone."
        instruct_custom = resolve_acoustic_instruct(custom_instruct=custom)
        self.assertIn(custom, instruct_custom)
        self.assertIn("som seco e direto sem eco", instruct_custom)

    def test_clean_text_for_tts(self):
        from app.services.voice_service import clean_text_for_tts

        # Interrobangs replaced by ?
        raw1 = "O que você disse?! Não pode ser!? Sério?!!"
        self.assertEqual(clean_text_for_tts(raw1), "O que você disse? Não pode ser? Sério?")

        # Multiple exclamation marks reduced to .
        raw2 = "Idiota!! Cale a boca!!!"
        self.assertEqual(clean_text_for_tts(raw2), "Idiota. Cale a boca.")

        # Preserves natural ellipses pause and strips emotion comments
        raw3 = "<!-- emotion: tsundere --> Não é como se... eu me importasse com você! Idiota!!"
        self.assertEqual(clean_text_for_tts(raw3), "Não é como se... eu me importasse com você! Idiota.")

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
