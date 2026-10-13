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

    def test_ping_worker_offline(self):
        # Probing a non-existent port should return status="offline" cleanly without throwing
        ping_res = asyncio.run(QwenTTSManager.ping_worker("http://127.0.0.1:59999"))
        self.assertEqual(ping_res["status"], "offline")
        self.assertIsNotNone(ping_res["ping_ms"])


if __name__ == "__main__":
    unittest.main()
