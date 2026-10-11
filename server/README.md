# 🧠 Amadeus Backend (FastAPI + ChromaDB + Neural Voice Engines)

High-performance Python backend server for the **Amadeus System**, orchestrating continuous episodic memory (RAG), psychological persona simulation, and neural speech synthesis with optional GPU-accelerated acoustic voice conversion.

---

## ⚡ Architecture Overview

The backend is built as a modular, decoupled multi-service pipeline:

```
[ Frontend Client (React 19) ]
       │ HTTP /api/chat & /api/tts
       ▼
[ FastAPI Core Server (:8000) ] ──── (Hybrid RAG: ChromaDB + SQLite)
       │
       ├──► Engine 1: Edge-TTS (Default / Universal / CPU-Only)
       │         └── Microsoft Azure Neural Cloud (pt-BR-FranciscaNeural, Nanami, etc.)
       │
       ├──► Engine 2: Kurisu RVC v2 Pipeline (:8001) [Optional GPU FP16]
       │         ├── Source: https://huggingface.co/FrancescoCaracciolo/Kurisu-RVC
       │         └── Asami Imai Original Voice Timbre (KurisuRVCv147)
       │
       └──► Engine 3: Kurisu Qwen3-TTS Worker (:8002) [Optional GPU BF16]
                 ├── Source: https://huggingface.co/starrydark/Kurisu_Qwen3_TTS
                 └── Direct End-to-End Neural Synthesis (1.7B Parameters)
```

1. **FastAPI Core Gateway (`:8000`)**:
   - Hybrid RAG memory engine using **ChromaDB** (semantic vector embeddings) and **SQLite** (sessions, chat history, and emotional sentiment tags).
   - Multi-provider LLM orchestration (Groq Cloud LPU Llama 3.3 70B, Google Gemini 2.5 Flash, OpenRouter) and a local deterministic offline simulator.
   - Resilient voice router (`voice_service.py`) providing automated health probing and instant fallback between engines.

2. **Universal Compatibility by Default (Runs on ANY Machine)**:
   - **No GPU Required**: By default, Amadeus synthesizes speech using Microsoft Edge-TTS. It runs out-of-the-box on standard desktop PCs, laptops, Windows, macOS, or Linux without downloading gigabytes of model weights or requiring an NVIDIA graphics card.
   - **Optional GPU Acceleration**: Operators with modern NVIDIA graphics cards (GTX 16-series, RTX 20/30/40 series, or any GPU with 4GB+ VRAM) can optionally enable local Kurisu RVC v2 conversion or the resident Qwen3-TTS worker for maximum voice fidelity.

---

## 📦 Neural Voice Models & Download Directory

### 1. Kurisu RVC v2 (Timbre Conversion) — [Optional GPU Acceleration]
* **Hugging Face Repository**: [FrancescoCaracciolo/Kurisu-RVC](https://huggingface.co/FrancescoCaracciolo/Kurisu-RVC/tree/main)
* **Voice Reference**: Asami Imai (今井 麻美) — Official Japanese voice actress for Makise Kurisu.
* **Required Files**:
  * `KurisuRVCv147.pth` (RVC generator weights)
  * `KurisuRVCv147.index` (Faiss feature retrieval index)
* **Directory Structure**:
  Place the downloaded weights inside `server/weights/kurisu_rvc/`:
  ```text
  server/
  └── weights/
      ├── kurisu_rvc/
      │   ├── KurisuRVCv147.pth
      │   └── KurisuRVCv147.index
      └── models/
          ├── hubert_base.pt
          └── rmvpe.pt
  ```

### 2. Kurisu Qwen3-TTS (Direct End-to-End Voice) — [Optional GPU Acceleration]
* **Hugging Face Repository**: [starrydark/Kurisu_Qwen3_TTS](https://huggingface.co/starrydark/Kurisu_Qwen3_TTS)
* **Base Architecture**: Alibaba Cloud Qwen3-TTS 1.7B
* **Model Download Options**:
  * **Automatic Download (Recommended)**: Weights (~3.5 GB) are automatically fetched on first startup via Hugging Face Hub into `~/.cache/huggingface/hub/`.
  * **Manual Clone (Offline Alternative)**: Clone into `server/weights/kurisu_qwen3/`:
    ```bash
    git lfs install
    git clone https://huggingface.co/starrydark/Kurisu_Qwen3_TTS server/weights/kurisu_qwen3
    ```
    The worker automatically checks for `server/weights/kurisu_qwen3/` before attempting remote downloads.
* **Requirements & Notes**: Requires modern NVIDIA GPU (4GB+ VRAM, CUDA 12.4). The `Warning: flash-attn is not installed` message during startup is harmless; PyTorch native SDPA kernel is used for inference.

### 3. Microsoft Edge-TTS — [Universal / Zero Setup]
* **Cost & Configuration**: 100% Free, requires no API keys and 0 MB of local weight downloads.
* **Supported Voices**: `pt-BR-FranciscaNeural` (Natural & Expressive), `pt-BR-ThalitaNeural` (Young & Fast), and `ja-JP-NanamiNeural` (Anime Original).

---

## 🛠️ Step-by-Step Local Setup

### 1. Core Server Setup (Works on ANY PC)

```powershell
# Navigate to server directory:
cd server

# Create virtual environment:
python -m venv rvc_env

# Activate virtual environment:
# On Windows (PowerShell):
.\rvc_env\Scripts\Activate.ps1
# On Linux / macOS:
source rvc_env/bin/activate

# Install dependencies:
pip install -r requirements.txt

# Start FastAPI server on port 8000:
python -m uvicorn main:app --reload --port 8000
```
Interactive OpenAPI documentation will be accessible at `http://localhost:8000/docs`.

---

### 2. Optional: Launching the Qwen3-TTS Worker (NVIDIA GPU Only)

If you have an NVIDIA GPU with CUDA 12.4 and wish to run the end-to-end Kurisu voice:

```powershell
# Windows (PowerShell):
cd server
python -m venv qwen_env
.\qwen_env\Scripts\Activate.ps1
pip install torch==2.6.0+cu124 torchaudio==2.6.0+cu124 --extra-index-url https://download.pytorch.org/whl/cu124
pip install -r requirements-qwen.txt
python -m app.services.qwen_tts.qwen_worker

# Linux:
cd server
python3 -m venv qwen_env
source qwen_env/bin/activate
pip install torch==2.6.0+cu124 torchaudio==2.6.0+cu124 --extra-index-url https://download.pytorch.org/whl/cu124
pip install -r requirements-qwen.txt
python -m app.services.qwen_tts.qwen_worker
```

> [!TIP]
> **Auto-Spawn**: When `qwen_env` exists inside `server/qwen_env`, the core FastAPI backend will automatically auto-spawn the worker process on port `8002` when Kurisu speech is requested.
>
> **Automatic Fallback**: If the Qwen3 worker is offline or the GPU runs out of VRAM, the core server instantly and transparently falls back to Edge-TTS without interrupting user dialogue.

---

## 🐳 Docker Deployment

The backend includes official Docker containerization with persistent data mounting:

```bash
# Build backend image:
docker build -t amadeus-backend ./server

# Run backend container:
docker run -d \
  -p 8000:8000 \
  -v "$(pwd)/server/data:/app/data" \
  -v "$(pwd)/server/weights:/app/weights" \
  --name amadeus-backend \
  amadeus-backend
```

Or spin up the complete full-stack environment from the repository root:
```bash
docker compose up -d
```

---

## 📡 Key REST Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check returning uptime, ChromaDB vector count, and active models |
| `/api/chat` | `POST` | Core chat route: context injection, RAG semantic search, and LLM orchestration |
| `/api/tts` | `POST` | Neural voice synthesis (`qwen3` or `edge_rvc`) with WAV/MP3 streaming |
| `/api/memories` | `GET` / `POST` | Semantic memory management (ChromaDB + SQLite) |
| `/api/sessions` | `GET` / `POST` | Conversation session persistence |
| `/api/divergence` | `GET` | Live worldline divergence meter telemetry |
