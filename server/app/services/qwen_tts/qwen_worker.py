import io
import os
import sys
import threading
import torch
import soundfile as sf
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

model = None
load_error = None
device_name = "cpu"
dtype_used = torch.float32


def _load_model_worker():
    global model, device_name, dtype_used, load_error
    print("[Qwen3 Worker] Background thread starting model load on GPU...")
    device_name = "cuda:0" if torch.cuda.is_available() else "cpu"
    dtype_used = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    print(f"[Qwen3 Worker] Target device: {device_name} ({dtype_used})...")

    try:
        from qwen_tts import Qwen3TTSModel
        loaded_model = Qwen3TTSModel.from_pretrained(
            "starrydark/Kurisu_Qwen3_TTS",
            device_map=device_name,
            dtype=dtype_used,
        )
        model = loaded_model
        print("[Qwen3 Worker] Model successfully loaded and resident in GPU memory!")
    except Exception as e:
        print(f"[Qwen3 Worker] Failed to load model: {e}")
        import traceback
        traceback.print_exc()
        load_error = str(e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start non-blocking background thread so Uvicorn binds and responds to HTTP /health immediately
    loader_thread = threading.Thread(target=_load_model_worker, daemon=True)
    loader_thread.start()
    yield
    print("[Qwen3 Worker] Worker shutting down cleanly.")


app = FastAPI(title="Amadeus Kurisu Qwen3-TTS Worker", version="1.0.0", lifespan=lifespan)


class SynthesizeRequest(BaseModel):
    text: str
    language: Optional[str] = "Portuguese"
    instruct: Optional[str] = None


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
    }


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    global model
    if model is None:
        raise HTTPException(status_code=503, detail="Qwen3-TTS Worker is still initializing.")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        with torch.inference_mode():
            wavs, sr = model.generate_custom_voice(
                text=text,
                speaker="kurisu",
                language=req.language or "Portuguese",
                instruct=req.instruct or None,
            )

        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format="WAV")
        wav_bytes = buffer.getvalue()

        # Free transient CUDA cached memory
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return Response(content=wav_bytes, media_type="audio/wav")

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
    uvicorn.run(app, host="127.0.0.1", port=8002)
