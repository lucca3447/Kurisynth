#!/usr/bin/env python3
"""
OpenAmadeus Companion - Remote Qwen3-TTS Worker
==============================================
Standalone, headless worker for running Qwen3-TTS 1.7B (starrydark/Kurisu_Qwen3_TTS)
on remote GPU instances (e.g., Google Colab Pro, RunPod, Kaggle, or a dedicated home server).

Features:
- Automatic GPU/VRAM detection and bfloat16 precision.
- Built-in Cloudflare Tunnel support (--tunnel cloudflare) for zero-port-forwarding connectivity.
- Streaming/fast WAV 24kHz synthesis with emotion instruction support.
- Fully compatible with OpenAmadeus Companion's Voice Engine fallback cascade.

Usage:
  python remote_worker.py --port 8005 --tunnel cloudflare
"""

import io
import os
import sys
import re
import time
import argparse
import threading
import torch
import soundfile as sf
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

# Global state
model = None
load_error = None
device_name = "cpu"
dtype_used = torch.float32
model_source_used = "starrydark/Kurisu_Qwen3_TTS"


def load_model(model_name: str = "starrydark/Kurisu_Qwen3_TTS", device: Optional[str] = None):
    global model, device_name, dtype_used, load_error, model_source_used
    print(f"\n[Amadeus Remote] Initializing Kurisu Qwen3-TTS ({model_name})...")
    
    if device is not None:
        device_name = device
    else:
        device_name = "cuda:0" if torch.cuda.is_available() else "cpu"

    dtype_used = torch.bfloat16 if "cuda" in device_name else torch.float32
    print(f"[Amadeus Remote] Accelerator Device: {device_name} | Precision: {dtype_used}")
    
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        total_vram = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)
        print(f"[Amadeus Remote] GPU Hardware: {gpu_name} ({total_vram} GB Total VRAM)")

    try:
        from qwen_tts import Qwen3TTSModel

        # Check local cache or directory before fetching from Hugging Face hub
        model_source = model_name
        if os.path.isdir(model_name):
            model_source = model_name
        
        print(f"[Amadeus Remote] Loading model weights from '{model_source}'...")
        t0 = time.perf_counter()
        loaded = Qwen3TTSModel.from_pretrained(
            model_source,
            device_map=device_name,
            dtype=dtype_used,
        )
        model = loaded
        model_source_used = model_source
        load_time = round(time.perf_counter() - t0, 2)
        print(f"[Amadeus Remote] Model successfully resident in memory in {load_time}s!")
        if torch.cuda.is_available():
            vram_mb = round(torch.cuda.memory_allocated() / (1024**2), 1)
            print(f"[Amadeus Remote] Active VRAM Allocation: {vram_mb} MB")

    except Exception as e:
        print(f"[Amadeus Remote] Error loading model: {e}")
        import traceback
        traceback.print_exc()
        load_error = str(e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    print("[Amadeus Remote] Worker shutting down cleanly.")


app = FastAPI(
    title="OpenAmadeus Remote Qwen3-TTS Worker",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SynthesizeRequest(BaseModel):
    text: str
    language: Optional[str] = "Portuguese"
    instruct: Optional[str] = None
    temperature: Optional[float] = 0.75
    top_p: Optional[float] = 0.95
    repetition_penalty: Optional[float] = 1.05


@app.get("/")
def root():
    return {
        "system": "OpenAmadeus Remote Qwen3-TTS Worker",
        "status": "ready" if model is not None else ("error" if load_error else "initializing"),
        "model": model_source_used,
        "device": device_name,
    }


@app.get("/health")
def health():
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
        "model": model_source_used,
    }


def split_into_semantic_blocks(text: str, max_chars: int = 280) -> list[str]:
    raw_sentences = [s.strip() for s in re.split(r'(?<=[.!?\n])\s+', text) if s.strip()]
    if not raw_sentences:
        return [text]

    chunks = []
    current_chunk = ""
    for s in raw_sentences:
        if not current_chunk:
            current_chunk = s
        elif len(current_chunk) + len(s) + 1 <= max_chars:
            current_chunk += " " + s
        else:
            chunks.append(current_chunk)
            current_chunk = s
    if current_chunk:
        chunks.append(current_chunk)
    return chunks


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    global model
    if model is None:
        raise HTTPException(
            status_code=503,
            detail=f"Qwen3-TTS Worker ainda inicializando ou com erro ({load_error or 'carregando...'})."
        )

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texto não pode ser vazio.")

    # Acoustic Continuity Policy:
    # Single-pass generation for short/medium phrases (< 300 chars) maintains 100% natural prosody
    should_chunk = len(text) > 300 and ("\n" in text or len(re.split(r'[.!?]\s+', text)) > 2)
    chunks = split_into_semantic_blocks(text, max_chars=280) if should_chunk else [text]

    t0 = time.perf_counter()
    try:
        import numpy as np
        audio_pieces = []
        sr_used = 24000

        for chunk in chunks:
            with torch.inference_mode():
                wavs, sr = model.generate_custom_voice(
                    text=chunk,
                    speaker="kurisu",
                    language=req.language or "Portuguese",
                    instruct=req.instruct or "Fale em tom tsundere e expressivo, som seco e direto sem eco.",
                    temperature=req.temperature or 0.75,
                    top_p=req.top_p or 0.95,
                    repetition_penalty=req.repetition_penalty or 1.05,
                )
                sr_used = sr
                if isinstance(wavs, list) and len(wavs) > 0:
                    piece = wavs[0]
                    if isinstance(piece, torch.Tensor):
                        piece = piece.detach().cpu().numpy()
                    audio_pieces.append(piece)

        if not audio_pieces:
            raise HTTPException(status_code=500, detail="Modelo não gerou áudio.")

        full_audio = np.concatenate(audio_pieces) if len(audio_pieces) > 1 else audio_pieces[0]
        
        # Squeeze mono channel if needed
        if full_audio.ndim > 1:
            full_audio = full_audio.squeeze()

        # Export in-memory 16-bit PCM WAV
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, sr_used, format="WAV", subtype="PCM_16")
        buffer.seek(0)
        audio_bytes = buffer.read()

        elapsed = round(time.perf_counter() - t0, 3)
        print(f"[Amadeus Remote] Synthesized {len(text)} chars in {elapsed}s ({len(audio_bytes)} bytes)")

        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={"Content-Disposition": "inline; filename=speech.wav"}
        )

    except Exception as e:
        print(f"[Amadeus Remote] Synthesis error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def start_cloudflare_tunnel(port: int):
    """
    Spawns Cloudflare Tunnel using pycloudflared to expose the local port to the web
    via a secure HTTPS endpoint (e.g. https://xxx.trycloudflare.com).
    """
    try:
        from pycloudflared import try_cloudflare
        print(f"\n[Amadeus Tunnel] Starting Cloudflare Tunnel for port {port}...")
        public_url = try_cloudflare(port=port)
        tunnel_url = public_url.tunnel if hasattr(public_url, "tunnel") else str(public_url)
        print("\n" + "=" * 65)
        print("  🌟 AMADEUS CLOUDFLARE TUNNEL ATIVO!")
        print(f"  URL Pública: {tunnel_url}")
        print("=" * 65)
        print("  Copie e cole a URL acima em 'Configurações > Voz > URL Remota (Colab)'\n")
        return tunnel_url
    except ImportError:
        print("\n[Amadeus Tunnel] 'pycloudflared' não está instalado.")
        print("Para túnel automático, instale com: pip install pycloudflared")
        print(f"Ou rode manualmente: cloudflared tunnel --url http://localhost:{port}\n")
        return None
    except Exception as e:
        print(f"[Amadeus Tunnel] Erro ao iniciar túnel Cloudflare: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="OpenAmadeus Remote Qwen3-TTS Worker")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8005, help="Port to listen on (default: 8005)")
    parser.add_argument("--model", type=str, default="starrydark/Kurisu_Qwen3_TTS", help="Hugging Face repo or local dir")
    parser.add_argument("--tunnel", choices=["cloudflare", "none"], default="none", help="Tunnel provider (default: none)")
    parser.add_argument("--async-load", action="store_true", help="Load model in background thread")
    args = parser.parse_args()

    # Load model synchronously or in background
    if args.async_load:
        threading.Thread(target=load_model, args=(args.model,), daemon=True).start()
    else:
        load_model(model_name=args.model)

    # Launch tunnel if requested
    if args.tunnel == "cloudflare":
        # Launch tunnel in background thread
        threading.Thread(target=start_cloudflare_tunnel, args=(args.port,), daemon=True).start()

    print(f"\n[Amadeus Remote] Starting HTTP server on {args.host}:{args.port}...")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
