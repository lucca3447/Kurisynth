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
    os.path.join(SERVER_DIR, "qwen_env", "bin", "python"),
    r"C:\codigos\qwentsskurisu\qwen_env\Scripts\python.exe",
    os.path.join(SERVER_DIR, "venv", "Scripts", "python.exe"),
    os.path.join(SERVER_DIR, "venv", "bin", "python"),
]

import socket

DEFAULT_WORKER_PORT = 8005
WORKER_PORT = int(os.environ.get("QWEN_WORKER_PORT", str(DEFAULT_WORKER_PORT)))
WORKER_SCRIPT = os.path.join(CURRENT_DIR, "qwen_worker.py")
WORKER_URL = f"http://127.0.0.1:{WORKER_PORT}"

_worker_process: Optional[subprocess.Popen] = None
_spawn_lock = asyncio.Lock()


def is_port_in_use(port: Optional[int] = None) -> bool:
    target_port = port if port is not None else WORKER_PORT
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.3)
            return s.connect_ex(('127.0.0.1', target_port)) == 0
    except Exception:
        return False


def kill_process_on_port(port: Optional[int] = None):
    """Kills any stale/orphaned process binding the target port to prevent EADDRINUSE collisions."""
    target_port = port if port is not None else WORKER_PORT
    if sys.platform != "win32":
        return
    try:
        cmd = f'netstat -ano | findstr :{target_port}'
        out = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL)
        for line in out.strip().splitlines():
            if "LISTENING" in line:
                parts = line.strip().split()
                pid = parts[-1]
                if pid and pid != "0":
                    subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
                    print(f"[Qwen3 Manager] Terminated stale process on port {target_port} (PID {pid}).")
    except Exception:
        pass


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

        if _worker_process is not None and _worker_process.poll() is None:
            return True

        py_exe = cls.get_python_executable()
        if not py_exe or not os.path.exists(WORKER_SCRIPT):
            print(f"[Qwen3 Manager] Cannot start worker: python binary ({py_exe}) or script not found.")
            return False

        try:
            print(f"[Qwen3 Manager] Spawning Qwen3 background worker via {py_exe} on port {WORKER_PORT}...")
            creationflags = 0
            if sys.platform == "win32":
                creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

            log_file = os.path.join(SERVER_DIR, "data", "qwen_worker.log")
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            log_handle = open(log_file, "a", encoding="utf-8")

            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"
            env["QWEN_WORKER_PORT"] = str(WORKER_PORT)
            env["HF_HUB_OFFLINE"] = "1"
            env["TRANSFORMERS_OFFLINE"] = "1"

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
    async def ensure_worker(cls, max_wait_sec: float = 150.0) -> bool:
        if await cls.is_worker_healthy():
            return True

        async with _spawn_lock:
            if await cls.is_worker_healthy():
                return True

            # If target worker port is occupied but unreachable/unhealthy, clean up stale zombie process
            if is_port_in_use(WORKER_PORT):
                status = await cls.get_worker_status()
                if status != "ready" and status != "initializing":
                    print(f"[Qwen3 Manager] Port {WORKER_PORT} occupied by unresponsive process. Clearing stale port...")
                    kill_process_on_port(WORKER_PORT)
                    await asyncio.sleep(0.5)

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
            is_healthy = await cls.ensure_worker(max_wait_sec=150.0)

        if not is_healthy:
            print("[Qwen3 Manager] Worker offline or initialization timed out; falling back to alternative engine.")
            return None

        # Resolve emotional and acoustic environment prompt
        instruct = resolve_acoustic_instruct(emotion=emotion, custom_instruct=custom_instruct)

        try:
            print(f"[Qwen3 Manager] Dispatching synthesis to worker (chars: {len(text)})...")
            async with httpx.AsyncClient(timeout=120.0) as client:
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
        except httpx.TimeoutException:
            print(f"[Qwen3 Manager] Synthesis timed out after 120s (utterance length: {len(text)} chars).")
        except Exception as e:
            print(f"[Qwen3 Manager] Communication error with worker: {e}")

        return None
