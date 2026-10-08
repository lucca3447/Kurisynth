import os
import sys
import torch
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

# Ensure path to rvc package is available
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", ".."))
WEIGHTS_DIR = os.path.join(SERVER_DIR, "weights")

if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from pipeline import KurisuRVCPipeline

app = FastAPI(title="Amadeus RVC Neural Voice Worker", version="1.0.0")

pipeline: KurisuRVCPipeline = None


@app.on_event("startup")
def startup_event():
    global pipeline
    hubert_path = os.path.join(WEIGHTS_DIR, "models", "hubert_base.pt")
    rmvpe_path = os.path.join(WEIGHTS_DIR, "models", "rmvpe.pt")
    model_path = os.path.join(WEIGHTS_DIR, "kurisu_rvc", "KurisuRVCv147.pth")
    index_path = os.path.join(WEIGHTS_DIR, "kurisu_rvc", "KurisuRVCv147.index")

    print("[RVC Worker] Initializing Kurisu RVC Pipeline...")
    pipeline = KurisuRVCPipeline(
        hubert_path=hubert_path,
        rmvpe_path=rmvpe_path,
        model_path=model_path,
        index_path=index_path,
        device="cuda" if torch.cuda.is_available() else "cpu",
        is_half=True if torch.cuda.is_available() else False,
    )
    print(f"[RVC Worker] Pipeline loaded successfully on {pipeline.device}!")


@app.get("/health")
def health_check():
    vram = torch.cuda.memory_allocated() / (1024**2) if torch.cuda.is_available() else 0
    return {
        "status": "ready" if pipeline is not None else "initializing",
        "device": pipeline.device if pipeline is not None else "unknown",
        "cuda_available": torch.cuda.is_available(),
        "vram_allocated_mb": round(vram, 2),
    }


@app.post("/convert")
async def convert_voice(
    audio_file: UploadFile = File(...),
    pitch_shift: int = Form(0),
    index_rate: float = Form(0.8),
):
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RVC Worker is initializing")

    try:
        content = await audio_file.read()
        out_wav = pipeline.convert_audio(
            audio_bytes=content,
            pitch_shift=pitch_shift,
            index_rate=index_rate,
        )
        return Response(content=out_wav, media_type="audio/wav")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Voice conversion failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
