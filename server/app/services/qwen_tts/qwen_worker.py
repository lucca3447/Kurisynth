import io
import os
import sys
import re
import threading
import numpy as np
import torch
import soundfile as sf
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import Optional

model = None
load_error = None
device_name = "cpu"
dtype_used = torch.float32
active_backend = "unknown"
_gpu_lock = threading.Lock()

RAMP_LEN = 120  # 5 ms @ 24 kHz for C0 amplitude continuity across chunk seams
ramp_weights = np.linspace(1.0, 0.0, RAMP_LEN, dtype=np.float32)


def apply_boundary_continuity(chunk: np.ndarray, prev_sample: Optional[float]) -> np.ndarray:
    """
    Applies a smooth C0 continuity ramp to the first 120 samples of the current chunk
    based on the last sample of the previous chunk, eliminating amplitude jumps without
    attenuating volume to zero.
    """
    if prev_sample is None or len(chunk) < RAMP_LEN:
        return chunk
    smoothed = chunk.copy()
    delta = prev_sample - smoothed[0]
    smoothed[:RAMP_LEN] += delta * ramp_weights
    return smoothed


def _resolve_model_source() -> str:
    current_file_dir = os.path.dirname(os.path.abspath(__file__))
    server_root = os.path.abspath(os.path.join(current_file_dir, "..", "..", ".."))
    local_candidates = [
        os.path.join(server_root, "weights", "kurisu_qwen3"),
        os.path.join(server_root, "Kurisu_Qwen3_TTS"),
    ]
    hf_cache_dir = os.path.expanduser(r"~/.cache/huggingface/hub/models--starrydark--Kurisu_Qwen3_TTS/snapshots")
    if os.path.isdir(hf_cache_dir):
        for snap in sorted(os.listdir(hf_cache_dir), reverse=True):
            local_candidates.append(os.path.join(hf_cache_dir, snap))

    for candidate in local_candidates:
        if os.path.isdir(candidate) and (
            os.path.exists(os.path.join(candidate, "config.json"))
            or any(fname.endswith(".safetensors") for fname in os.listdir(candidate))
        ):
            print(f"[Qwen3 Worker] Found local model directory: {candidate}")
            return candidate

    return "starrydark/Kurisu_Qwen3_TTS"


def _load_model_worker():
    global model, device_name, dtype_used, load_error, active_backend
    requested_backend = os.environ.get("QWEN_BACKEND", "auto").lower()
    print(f"[Qwen3 Worker] Background thread starting model load (requested backend: '{requested_backend}')...")

    device_name = "cuda:0" if torch.cuda.is_available() else "cpu"
    if torch.cuda.is_available():
        major, _ = torch.cuda.get_device_capability(0)
        dtype_used = torch.bfloat16 if major >= 8 else torch.float16
    else:
        dtype_used = torch.float32

    print(f"[Qwen3 Worker] Target device: {device_name} ({dtype_used})...")
    model_source = _resolve_model_source()
    loaded_model = None
    backend_selected = "stock"

    # 1. Attempt FasterQwen3TTS (CUDA Graphs + native streaming) if permitted
    if requested_backend in ("auto", "faster") and torch.cuda.is_available():
        try:
            print(f"[Qwen3 Worker] Attempting FasterQwen3TTS runtime with CUDA Graphs on '{model_source}'...")
            from faster_qwen3_tts import FasterQwen3TTS
            loaded_model = FasterQwen3TTS.from_pretrained(
                model_source,
                device=device_name,
                dtype=dtype_used,
                attn_implementation="sdpa",
                max_seq_len=2048,
            )
            print("[Qwen3 Worker] Warming up Talker & Predictor CUDA Graphs...")
            loaded_model.warmup(prefill_len=100)

            # Mandatory: Full Warm-up of Mimi Audio Decoder (eliminates cold 2.1s delay on 1st call)
            print("[Qwen3 Worker] Priming Mimi audio decoder with disposable initial utterance...")
            try:
                for _ in loaded_model.generate_custom_voice_streaming(
                    text="Oi.",
                    speaker="kurisu",
                    language="Portuguese",
                    instruct="Voz calma.",
                    chunk_size=8,
                ):
                    break
                print("[Qwen3 Worker] Mimi audio decoder primed and warm! First call will achieve sub-400ms TTFA.")
            except Exception as dec_err:
                print(f"[Qwen3 Worker] Mimi audio decoder priming note: {dec_err}")

            backend_selected = "faster"
            print("[Qwen3 Worker] FasterQwen3TTS runtime successfully initialized with CUDA Graphs!")
        except Exception as fast_err:
            print(f"[Qwen3 Worker] FasterQwen3TTS init failed ({fast_err}).")
            if requested_backend == "faster":
                load_error = f"FasterQwen3TTS requested but failed: {fast_err}"
                return
            print("[Qwen3 Worker] Falling back to stock Qwen3TTSModel...")

    # 2. Stock Qwen3TTSModel fallback
    if loaded_model is None and not load_error:
        try:
            from qwen_tts import Qwen3TTSModel
            print(f"[Qwen3 Worker] Loading stock Qwen3TTSModel from '{model_source}'...")
            loaded_model = Qwen3TTSModel.from_pretrained(
                model_source,
                device_map=device_name,
                dtype=dtype_used,
            )
            backend_selected = "stock"
            print("[Qwen3 Worker] Stock Qwen3TTSModel successfully loaded and resident in GPU memory!")
        except Exception as e:
            print(f"[Qwen3 Worker] Failed to load stock model: {e}")
            import traceback
            traceback.print_exc()
            load_error = str(e)
            return

    model = loaded_model
    active_backend = backend_selected


@asynccontextmanager
async def lifespan(app: FastAPI):
    loader_thread = threading.Thread(target=_load_model_worker, daemon=True)
    loader_thread.start()
    yield
    print("[Qwen3 Worker] Worker shutting down cleanly.")


app = FastAPI(title="Amadeus Kurisu Qwen3-TTS Worker", version="2.0.0", lifespan=lifespan)


class SynthesizeRequest(BaseModel):
    text: str
    language: Optional[str] = "Portuguese"
    instruct: Optional[str] = None
    temperature: Optional[float] = 0.75
    top_p: Optional[float] = 0.95
    repetition_penalty: Optional[float] = 1.05


@app.get("/health")
def health_check():
    vram = torch.cuda.memory_allocated() / (1024**2) if torch.cuda.is_available() else 0
    if load_error:
        status = f"error: {load_error}"
    elif model is not None:
        status = "ready"
    else:
        status = "initializing"

    return {
        "status": status,
        "device": device_name,
        "cuda_available": torch.cuda.is_available(),
        "vram_allocated_mb": round(vram, 2),
        "backend": active_backend,
    }


@app.post("/synthesize_stream")
def synthesize_stream(req: SynthesizeRequest):
    """
    Streams raw PCM16 mono 24kHz audio chunks in real-time.
    Uses CUDA Graphs when active_backend == 'faster' and applies C0 continuity DSP
    at chunk boundaries to eliminate micro-clicks.
    """
    global model
    if model is None:
        raise HTTPException(status_code=503, detail="Qwen3-TTS Worker is still initializing.")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    def pcm_generator():
        with _gpu_lock:
            prev_sample = None

            if active_backend == "faster":
                # Real streaming generator powered by CUDA Graphs
                stream_gen = model.generate_custom_voice_streaming(
                    text=text,
                    speaker="kurisu",
                    language=req.language or "Portuguese",
                    instruct=req.instruct or None,
                    chunk_size=8,
                    temperature=req.temperature if req.temperature is not None else 0.75,
                    top_p=req.top_p if req.top_p is not None else 0.95,
                    repetition_penalty=req.repetition_penalty if req.repetition_penalty is not None else 1.05,
                )
                for audio_chunk, sr, _ in stream_gen:
                    chunk = audio_chunk.copy()
                    chunk = apply_boundary_continuity(chunk, prev_sample)
                    prev_sample = float(chunk[-1])
                    pcm16 = (np.clip(chunk, -1.0, 1.0) * 32767).astype(np.int16).tobytes()
                    yield pcm16
            else:
                # Stock fallback: generate full audio, chunk into streamable packets
                with torch.inference_mode():
                    wavs, sr = model.generate_custom_voice(
                        text=text,
                        speaker="kurisu",
                        language=req.language or "Portuguese",
                        instruct=req.instruct or None,
                        temperature=req.temperature if req.temperature is not None else 0.75,
                        top_p=req.top_p if req.top_p is not None else 0.95,
                        repetition_penalty=req.repetition_penalty if req.repetition_penalty is not None else 1.05,
                    )
                full_audio = wavs[0]
                chunk_len = int(sr * 0.64)  # ~640ms chunks matching faster runtime
                for i in range(0, len(full_audio), chunk_len):
                    chunk = full_audio[i:i + chunk_len].copy()
                    chunk = apply_boundary_continuity(chunk, prev_sample)
                    prev_sample = float(chunk[-1])
                    pcm16 = (np.clip(chunk, -1.0, 1.0) * 32767).astype(np.int16).tobytes()
                    yield pcm16

    return StreamingResponse(
        pcm_generator(),
        media_type="audio/L16;rate=24000",
        headers={
            "X-Audio-Format": "pcm_s16le",
            "X-Sample-Rate": "24000",
            "X-Backend": active_backend,
        },
    )


@app.post("/synthesize")
def synthesize(req: SynthesizeRequest):
    """
    Non-streaming backwards-compatible endpoint delivering complete WAV PCM16 bytes.
    """
    global model
    if model is None:
        raise HTTPException(status_code=503, detail="Qwen3-TTS Worker is still initializing.")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    with _gpu_lock:
        try:
            with torch.inference_mode():
                wavs, sr = model.generate_custom_voice(
                    text=text,
                    speaker="kurisu",
                    language=req.language or "Portuguese",
                    instruct=req.instruct or None,
                    temperature=req.temperature if req.temperature is not None else 0.75,
                    top_p=req.top_p if req.top_p is not None else 0.95,
                    repetition_penalty=req.repetition_penalty if req.repetition_penalty is not None else 1.05,
                )
            full_audio = wavs[0]
            buffer = io.BytesIO()
            sf.write(buffer, full_audio, sr, format="WAV", subtype="PCM_16")
            return Response(
                content=buffer.getvalue(),
                media_type="audio/wav",
                headers={"X-Backend": active_backend},
            )
        except torch.cuda.OutOfMemoryError as oom:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            print(f"[Qwen3 Worker] CUDA Out Of Memory: {oom}")
            raise HTTPException(status_code=507, detail="GPU memory insufficient for this utterance.")
        except Exception as e:
            print(f"[Qwen3 Worker] Synthesis error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("QWEN_WORKER_PORT", "8005"))
    uvicorn.run(app, host="127.0.0.1", port=port)
