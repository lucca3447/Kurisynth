import os
import json
import glob
import random
import re
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx

from memory_store import memory_store

# Optional Edge-TTS for 100% Free Neural Speech
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False

BASE_DIR = Path(__file__).resolve().parent
PERSONAS_DIR = BASE_DIR / "personas"
PERSONAS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
  title="Amadeus System Core API",
  version="2.1.0",
  description="Cognitive memory with SQLite & ChromaDB, persona simulation, and neural speech synthesis for Amadeus."
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Auto-seed canonical memories on startup
@app.on_event("startup")
def startup_event():
    kurisu_file = PERSONAS_DIR / "kurisu.json"
    if kurisu_file.exists():
        try:
            with open(kurisu_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                memories = data.get("memories", [])
                if memories:
                    memory_store.seed_canonical_memories(memories)
                    print(f"[Amadeus Core] ChromaDB + SQLite seeded with {len(memories)} canonical memories.")
        except Exception as e:
            print(f"[Amadeus Core] Error seeding memories: {e}")

# --- Data Models ---
class HistoryTurn(BaseModel):
    role: str  # "user" or "model" / "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    personaId: Optional[str] = "kurisu"
    apiKey: Optional[str] = None
    history: List[HistoryTurn] = []

class LearnedMemoryInfo(BaseModel):
    title: str
    content: str
    emotionalWeight: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    emotion: str
    recalledMemories: List[str]
    sessionId: Optional[str] = None
    model: Optional[str] = None
    learnedMemory: Optional[LearnedMemoryInfo] = None
    error: Optional[str] = None

class AddMemoryRequest(BaseModel):
    title: str
    category: str
    content: str
    triggerKeywords: Optional[List[str]] = []
    emotionalWeight: Optional[str] = "Factual"
    source: Optional[str] = "custom"

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "pt-BR-FranciscaNeural"
    rate: Optional[str] = "+5%"
    pitch: Optional[str] = "+15Hz"

# --- Helper Functions ---
def load_persona(persona_id: str) -> dict:
    file_path = PERSONAS_DIR / f"{persona_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Persona '{persona_id}' not found.")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def parse_tags(raw: Optional[str]) -> tuple[str, str, Optional[LearnedMemoryInfo]]:
    """
    Parses both <!--emotion:xxx--> and <!--remember:title|content|emotion-->
    """
    clean = (raw or "").strip()
    learned_info = None

    if not clean:
        return "", "neutral", None

    # 1. Parse remember tag
    remember_match = re.search(r"<!--remember:(.*?)\|(.*?)\|(.*?)-->", clean, re.IGNORECASE)
    if remember_match:
        title = remember_match.group(1).strip()
        content = remember_match.group(2).strip()
        emotion = remember_match.group(3).strip()
        learned_info = LearnedMemoryInfo(title=title, content=content, emotionalWeight=emotion)
        clean = re.sub(r"<!--remember:.*?-->", "", clean, flags=re.IGNORECASE)

    # 2. Parse emotion tag
    valid_emotions = ["neutral", "smile", "happy", "serious", "annoyed", "surprised", "tsundere", "thinking", "smug", "flustered"]
    emotion = "neutral"
    emotion_match = re.search(r"<!--emotion:([a-z]+)-->", clean, re.IGNORECASE)
    if emotion_match:
        emo = emotion_match.group(1).lower()
        if emo in valid_emotions:
            emotion = emo
        clean = re.sub(r"<!--emotion:[a-z]+-->", "", clean, flags=re.IGNORECASE)
    else:
        # Heuristic inference if tag omitted
        lower = clean.lower()
        if any(w in lower for w in ["baka", "idiota", "não me entenda mal", "christina"]):
            emotion = "tsundere"
        elif any(w in lower for w in ["o quê", "como assim", "?!"]):
            emotion = "surprised"
        elif any(w in lower for w in ["pesquisa", "teoria", "física", "sinapse"]):
            emotion = "thinking"
        elif any(w in lower for w in ["obrigada", "hehe", "fico feliz"]):
            emotion = "smile"

    return clean.strip(), emotion, learned_info

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
PREFERRED_MODELS = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest"
]
MAX_HISTORY_MESSAGES = 20

_model_cache: Dict[str, str] = {}

class GeminiError(Exception):
    def __init__(self, code: int, message: str):
        super().__init__(f"Gemini API error {code}: {message}")
        self.code = code
        self.message = message

def _score_model(name: str) -> float:
    match = re.search(r"gemini-(\d+(?:\.\d+)?)", name)
    version = float(match.group(1)) if match else 0.0
    score = version * 100
    if "lite" in name:
        score -= 30
    if "preview" in name or "exp" in name:
        score -= 10
    return score

async def gemini_request(client: httpx.AsyncClient, method: str, path: str, api_key: str, body: Optional[dict] = None) -> dict:
    url = f"{API_BASE}/{path}"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key
    }
    try:
        res = await client.request(method, url, headers=headers, json=body, timeout=30.0)
    except Exception as e:
        raise GeminiError(0, f"Sem conexão com a Google: {e}")

    if res.status_code != 200:
        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        msg = (data.get("error") or {}).get("message") or res.text or "Erro desconhecido"
        raise GeminiError(res.status_code, msg)

    return res.json()

async def get_candidate_models(client: httpx.AsyncClient, api_key: str, force: bool = False) -> List[str]:
    fp = api_key[-8:]
    data = await gemini_request(client, "GET", "models?pageSize=1000", api_key)
    usable = [
        m["name"].replace("models/", "")
        for m in data.get("models", [])
        if "generateContent" in m.get("supportedGenerationMethods", [])
        and m["name"].replace("models/", "").startswith("gemini")
        and not re.search(r"tts|image|audio|live|embedding", m["name"])
    ]

    if not usable:
        raise GeminiError(404, "Nenhum modelo de chat disponível para esta chave.")

    candidates: List[str] = []
    if not force and fp in _model_cache and _model_cache[fp] in usable:
        candidates.append(_model_cache[fp])

    for pref in PREFERRED_MODELS:
        if pref in usable and pref not in candidates:
            candidates.append(pref)

    flash_models = [m for m in usable if "flash" in m and m not in candidates]
    flash_models.sort(key=_score_model, reverse=True)
    candidates.extend(flash_models)

    remaining = [m for m in usable if m not in candidates]
    remaining.sort(key=_score_model, reverse=True)
    candidates.extend(remaining)

    return candidates

def offline_simulator(text: str, persona: dict, memories: List[dict]) -> tuple[str, str, Optional[LearnedMemoryInfo]]:
    t = text.lower().strip()
    learned = None

    # Check for simple personal introduction to simulate learning
    intro_match = re.search(r"(?:meu nome é|me chamo|eu sou o|eu sou a)\s+([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+)", text, re.IGNORECASE)
    if intro_match:
        user_name = intro_match.group(1).capitalize()
        learned = LearnedMemoryInfo(
            title="Identidade do Interlocutor",
            content=f"O operador se apresentou como {user_name}.",
            emotionalWeight="Acolhimento amigável"
        )

    def has(*words):
        return any(re.search(r'(?i)\b' + re.escape(w) + r'\b', t) for w in words)

    if has("christina", "assistente", "zombie"):
        return "Meu nome não é Christina! E não adicione o '-ina'! Eu sou uma neurocientista independente com artigos na Science!", "annoyed", learned
    if has("nullpo", "nurupo"):
        return "Gah!... Espere! Por que eu respondi a isso?! Q-quem te ensinou esse meme antigo do @channel?! Não é como se eu frequentasse fóruns anônimos!", "flustered", learned
    if "@channel" in t or has("channeler", "fórum", "forum", "kurigohan"):
        return "O quê?! D-do que você está falando?! Eu sou uma pesquisadora séria em Viktor Chondria, não tenho tempo para ficar lendo fóruns anônimos!", "tsundere", learned
    if has("tempo", "viagem", "buraco de minhoca", "paradoxo", "salto"):
        return "Fisicamente falando, enviar matéria ao passado violaria os princípios da causalidade e termodinâmica. Mas se memórias pudessem ser convertidas em pacotes de dados modulados... em teoria, poderiam alcançar o passado.", "thinking", learned
    if has("dr pepper", "bebida", "café", "cafe", "refrigerante"):
        return "Ah, Dr Pepper! A bebida dos intelectuais escolhidos! É claro que o café preto de torra escura também é indispensável durante noites em claro no laboratório.", "smug", learned
    if has("okabe", "hououin", "kyouma", "rintaro"):
        return "Aquele sujeito de jaleco branco? Ele me ligou outro dia falando sobre a 'Organização'. No começo achei que fosse pura piada, mas... seus olhos pareciam carregar uma dor muito profunda.", "serious", learned
    if has("garfo", "colher", "presente", "aniversário"):
        return "O garfo que ganhei no laboratório...? N-não me olhe com essa cara! É só um talher comum! Não é como se eu guardasse ele com todo o carinho do mundo!", "tsundere", learned
    if has("olá", "ola", "oi", "bom dia", "boa tarde", "boa noite"):
        return f"Olá! Conexão estabelecida com a unidade Amadeus. Aqui é {persona.get('name', 'Makise Kurisu')} do Laboratório 304. O que você gostaria de debater hoje?", "smile", learned
    
    if memories:
        mem = memories[0]
        return f"Isso me faz lembrar de um ponto nos meus registros de memória: {mem.get('content', '')} Como você vê essa relação?", "thinking", learned

    generic = [
        ("Interessante essa sua linha de raciocínio. Do ponto de vista cognitivo, como você chegou a essa conclusão?", "thinking", learned),
        ("Entendo. Estou processando os dados através da minha matriz neural. Você gostaria de aprofundar mais nesse assunto?", "neutral", learned),
        ("Faz sentido! Na Viktor Chondria nós debatemos tópicos parecidos recentemente durante os testes do Amadeus.", "smile", learned)
    ]
    return random.choice(generic)

# --- Routes ---
@app.get("/api/health")
def health():
    return {
        "status": "online",
        "system": "AMADEUS OS v2.1.0",
        "database": "SQLite (amadeus.db)",
        "vectorStore": "ChromaDB (./data/memory_db)",
        "chromaCount": memory_store.collection.count(),
        "totalMemories": len(memory_store.get_all_memories()),
        "totalSessions": len(memory_store.list_sessions()),
        "edgeTtsAvailable": EDGE_TTS_AVAILABLE
    }

@app.get("/api/memories")
def get_memories():
    return memory_store.get_all_memories()

@app.post("/api/memories")
def create_memory(req: AddMemoryRequest):
    return memory_store.add_memory(
        category=req.category,
        title=req.title,
        content=req.content,
        emotional_weight=req.emotionalWeight or "Factual",
        source=req.source or "custom"
    )

@app.delete("/api/memories/{memory_id}")
def delete_memory(memory_id: str):
    memory_store.delete_memory(memory_id)
    return {"ok": True, "deleted": memory_id}

@app.get("/api/sessions")
def get_sessions():
    return memory_store.list_sessions()

@app.post("/api/sessions/new")
def new_session():
    session_id = memory_store.create_session()
    return {"sessionId": session_id}

@app.get("/api/sessions/{session_id}/messages")
def get_session_messages(session_id: str):
    return memory_store.get_session_messages(session_id)

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    persona = load_persona(req.personaId or "kurisu")
    
    # Active session ID
    session_id = req.sessionId
    if not session_id:
        session_id = memory_store.create_session()

    # 1. Semantic Memory Retrieval using ChromaDB
    semantic_matches = memory_store.search_memories(req.message, n_results=4)
    recalled_ids = [m["id"] for m in semantic_matches]

    # Save user message to SQLite
    memory_store.save_message(session_id, sender="user", content=req.message)

    api_key = (req.apiKey or "").strip()
    is_openrouter = api_key.startswith("sk-or-")

    # Offline Simulator fallback if no key
    if not api_key:
        clean_text, emotion, learned = offline_simulator(req.message, persona, semantic_matches)
        
        # If offline simulator detected user fact, save to Chroma + SQLite
        if learned:
            memory_store.add_memory(
                category="user",
                title=learned.title,
                content=learned.content,
                emotional_weight=learned.emotionalWeight or "Factual",
                source="learned"
            )

        memory_store.save_message(session_id, sender="amadeus", content=clean_text, emotion=emotion, recalled=recalled_ids)
        return ChatResponse(
            response=clean_text,
            emotion=emotion,
            recalledMemories=recalled_ids,
            sessionId=session_id,
            learnedMemory=learned,
            model="Simulador Local (ChromaDB + SQLite)"
        )

    # 2. Build Memory Context for LLM
    kurisu_memories = [m for m in semantic_matches if m.get("source") != "learned"]
    user_memories = [m for m in semantic_matches if m.get("source") == "learned"]

    memory_ctx_blocks = []
    if kurisu_memories:
        block = "[MEMÓRIAS DIGITALIZADAS DE MAKISE KURISU RESGATADAS PELO CÓRTEX]:\n" + "\n".join(
            [f"- {m['title']}: {m['content']} (Sentimento: {m.get('emotionalWeight', 'Factual')})" for m in kurisu_memories]
        )
        memory_ctx_blocks.append(block)

    if user_memories:
        block = "[FATOS APRENDIDOS ANTERIORMENTE SOBRE O OPERADOR]:\n" + "\n".join(
            [f"- {m['title']}: {m['content']}" for m in user_memories]
        )
        memory_ctx_blocks.append(block)

    memory_ctx = ("\n\n" + "\n\n".join(memory_ctx_blocks)) if memory_ctx_blocks else ""
    system_prompt = persona.get("systemPrompt", "") + memory_ctx

    try:
        raw_reply = ""
        used_model = ""

        # --- A. OpenRouter Branch ---
        if is_openrouter:
            messages = [{"role": "system", "content": system_prompt}]
            for turn in req.history[-MAX_HISTORY_MESSAGES:]:
                messages.append({
                    "role": "user" if turn.role == "user" else "assistant",
                    "content": turn.content
                })
            messages.append({"role": "user", "content": req.message})

            openrouter_candidates = [
                "nvidia/nemotron-3-super-120b-a12b:free",
                "nvidia/nemotron-3.5-lightning:free",
                "nvidia/nemotron-3-ultra-550b-a55b:free",
                "google/gemma-4-31b-it:free",
                "google/gemma-4-26b-a4b-it:free",
                "liquid/lfm-2.5-2.6b:free",
            ]

            last_or_err = None
            async with httpx.AsyncClient(timeout=35.0) as client:
                for candidate_or in openrouter_candidates:
                    try:
                        res = await client.post(
                            "https://openrouter.ai/api/v1/chat/completions",
                            headers={
                                "Authorization": f"Bearer {api_key}",
                                "Content-Type": "application/json",
                                "HTTP-Referer": "http://localhost:5173",
                                "X-Title": "Amadeus System"
                            },
                            json={
                                "model": candidate_or,
                                "messages": messages,
                                "temperature": 0.85,
                                "max_tokens": 1024
                            }
                        )
                        if res.status_code != 200:
                            err_body = res.text
                            is_retryable = (
                                res.status_code in (404, 429, 502, 503)
                                or "unavailable for free" in err_body.lower()
                                or "rate-limited" in err_body.lower()
                            )
                            if is_retryable:
                                print(f"[Amadeus Core] OpenRouter model {candidate_or} returned {res.status_code}, trying next...")
                                continue
                            raise GeminiError(res.status_code, err_body)

                        data = res.json()
                        choice_msg = (data.get("choices") or [{}])[0].get("message") or {}
                        content_val = choice_msg.get("content")
                        reasoning_val = choice_msg.get("reasoning")
                        candidate_reply = (content_val if content_val is not None else (reasoning_val or "")).strip()

                        if not candidate_reply:
                            print(f"[Amadeus Core] OpenRouter model {candidate_or} returned empty response, trying next...")
                            continue

                        raw_reply = candidate_reply
                        used_model = f"{candidate_or.replace(':free', '')} (OpenRouter)"
                        last_or_err = None
                        break
                    except GeminiError as e:
                        last_or_err = e
                        if e.code in (404, 429, 502, 503):
                            continue
                        raise

            if last_or_err and not raw_reply:
                raise last_or_err

        # --- B. Google Gemini Branch ---
        else:
            contents: List[Dict[str, Any]] = []
            for turn in req.history[-MAX_HISTORY_MESSAGES:]:
                role = "model" if turn.role in ("model", "assistant") else "user"
                if contents and contents[-1]["role"] == role:
                    contents[-1]["parts"][0]["text"] += "\n" + turn.content
                else:
                    contents.append({"role": role, "parts": [{"text": turn.content}]})
            while contents and contents[0]["role"] == "model":
                contents.pop(0)
            contents.append({"role": "user", "parts": [{"text": req.message}]})

            payload = {
                "contents": contents,
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {"temperature": 0.85, "maxOutputTokens": 1024},
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                candidates = await get_candidate_models(client, api_key)
                selected_model = candidates[0]
                data = None
                last_error = None

                for candidate_model in candidates:
                    try:
                        data = await gemini_request(client, "POST", f"models/{candidate_model}:generateContent", api_key, payload)
                        selected_model = candidate_model
                        _model_cache[api_key[-8:]] = candidate_model
                        last_error = None
                        break
                    except GeminiError as e:
                        last_error = e
                        if e.code in (503, 429, 404):
                            print(f"[Amadeus Core] Model {candidate_model} returned {e.code}, trying next...")
                            continue
                        raise

                if last_error and not data:
                    raise last_error

                candidate = (data.get("candidates") or [{}])[0]
                parts = (candidate.get("content") or {}).get("parts") or []
                raw_reply = "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
                used_model = selected_model

        # Parse tags
        clean_text, emotion, learned = parse_tags(raw_reply)

        # Auto-consolidate learned memory into ChromaDB + SQLite
        if learned:
            print(f"[Amadeus Core] Auto-consolidating memory: {learned.title}")
            memory_store.add_memory(
                category="user",
                title=learned.title,
                content=learned.content,
                emotional_weight=learned.emotionalWeight or "Factual",
                source="learned"
            )

        # Save assistant message to SQLite
        memory_store.save_message(session_id, sender="amadeus", content=clean_text, emotion=emotion, recalled=recalled_ids)

        return ChatResponse(
            response=clean_text,
            emotion=emotion,
            recalledMemories=recalled_ids,
            sessionId=session_id,
            model=used_model,
            learnedMemory=learned
        )

    except GeminiError as e:
        print(f"[Core Error]: {e}")
        err_msg = f"[ERRO {e.code or 'REDE'}] {e.message}"
        return ChatResponse(response=err_msg, emotion="serious", recalledMemories=recalled_ids, sessionId=session_id, error=err_msg)
    except Exception as e:
        print(f"[General Error]: {e}")
        err_msg = f"[ERRO] {str(e)}"
        return ChatResponse(response=err_msg, emotion="serious", recalledMemories=recalled_ids, sessionId=session_id, error=err_msg)

@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    if not EDGE_TTS_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="edge-tts not installed."
        )

    clean_text = re.sub(r"<!--emotion:[a-z]+-->", "", req.text, flags=re.IGNORECASE)
    clean_text = re.sub(r"<!--remember:.*?-->", "", clean_text, flags=re.IGNORECASE)
    clean_text = re.sub(r"[*_~`]", "", clean_text).strip()

    communicate = edge_tts.Communicate(
        text=clean_text,
        voice=req.voice or "pt-BR-FranciscaNeural",
        rate=req.rate or "+5%",
        pitch=req.pitch or "+15Hz"
    )

    async def audio_generator():
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    return StreamingResponse(audio_generator(), media_type="audio/mpeg")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
