import os
import sys
import subprocess
import asyncio
from typing import Optional
import httpx

from .emotion_mapper import resolve_acoustic_instruct

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", ".."))

# Candidate virtual environments with qwen-tts and torch+cu124 installed
CANDIDATE_PYTHONS = [
    os.path.join(SERVER_DIR, "qwen_env", "Scripts", "python.exe"),
    r"C:\codigos\qwentsskurisu\qwen_env\Scripts\python.exe",
    os.path.join(SERVER_DIR, "venv", "Scripts", "python.exe"),
]

WORKER_SCRIPT = os.path.join(CURRENT_DIR, "qwen_worker.py")
WORKER_URL = "http://127.0.0.1:8002"

_worker_process: Optional[subprocess.Popen] = None


class QwenTTSManager:
    @classmethod
    def get_python_executable(cls) -> Optional[str]:
        for candidate in CANDIDATE_PYTHONS:
            if os.path.exists(candidate):
                return candidate
        return None

    @classmethod
    async def is_worker_healthy(cls) -> bool:
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                res = await client.get(f"{WORKER_URL}/health")
                if res.status_code == 200:
                    data = res.json()
                    return data.get("status") == "ready"
        except Exception:
            pass
        return False

    @classmethod
    def start_worker_process(cls) -> bool:
        global _worker_process
        py_exe = cls.get_python_executable()
        if not py_exe or not os.path.exists(WORKER_SCRIPT):
            print(f"[Qwen3 Manager] Cannot start worker: python binary ({py_exe}) or script not found.")
            return False

        try:
            print(f"[Qwen3 Manager] Spawning Qwen3 background worker via {py_exe} on port 8002...")
            creationflags = 0
            if sys.platform == "win32":
                creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

            log_file = os.path.join(SERVER_DIR, "data", "qwen_worker.log")
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            log_handle = open(log_file, "a", encoding="utf-8")

            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"

            _worker_process = subprocess.Popen(
                [py_exe, WORKER_SCRIPT],
                cwd=CURRENT_DIR,
                creationflags=creationflags,
                stdout=log_handle,
                stderr=log_handle,
                env=env,
            )
            return True
        except Exception as e:
            print(f"[Qwen3 Manager] Error spawning worker: {e}")
            return False

    @classmethod
    async def get_worker_status(cls) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get(f"{WORKER_URL}/health")
                if res.status_code == 200:
                    data = res.json()
                    return data.get("status")
        except Exception:
            pass
        return None

    @classmethod
    async def ensure_worker(cls, max_wait_sec: float = 65.0) -> bool:
        if await cls.is_worker_healthy():
            return True

        if not cls.start_worker_process():
            return False

        print("[Qwen3 Manager] Waiting for model to load into GPU memory...")
        start_time = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start_time < max_wait_sec:
            await asyncio.sleep(1.0)
            status = await cls.get_worker_status()
            if status == "ready":
                print("[Qwen3 Manager] Qwen3 Worker is ready and resident in GPU memory!")
                return True
            if status and status.startswith("error:"):
                print(f"[Qwen3 Manager] Worker reported initialization failure: {status}")
                return False

        print("[Qwen3 Manager] Timeout waiting for Qwen3 Worker initialization.")
        return False

    @classmethod
    async def synthesize(
        cls,
        text: str,
        emotion: Optional[str] = None,
        custom_instruct: Optional[str] = None,
        language: str = "Portuguese",
    ) -> Optional[bytes]:
        """
        Synthesizes speech using the resident Kurisu Qwen3-TTS worker.
        Returns WAV audio bytes, or None if worker is offline or fails (allowing graceful fallback).
        """
        is_healthy = await cls.is_worker_healthy()
        if not is_healthy:
            is_healthy = await cls.ensure_worker(max_wait_sec=65.0)

        if not is_healthy:
            print("[Qwen3 Manager] Worker offline or initialization timed out; falling back to alternative engine.")
            return None

        # Resolve emotional and acoustic environment prompt
        instruct = resolve_acoustic_instruct(emotion=emotion, custom_instruct=custom_instruct)

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(
                    f"{WORKER_URL}/synthesize",
                    json={
                        "text": text,
                        "language": language or "Portuguese",
                        "instruct": instruct,
                    },
                )
                if res.status_code == 200:
                    return res.content
                print(f"[Qwen3 Manager] Worker returned error {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[Qwen3 Manager] Communication error with worker: {e}")

        return None
