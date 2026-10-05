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
  version="2.0.4",
  description="Cognitive memory, persona simulation, and neural speech synthesis for Amadeus."
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# --- Data Models ---
class MemoryItem(BaseModel):
    id: str
    category: str
    title: str
    triggerKeywords: List[str]
    content: str
    emotionalWeight: Optional[str] = "Factual / Neutro"

class PersonaProfile(BaseModel):
    id: str
    name: str
    codeName: str
    title: str
    affiliation: str
    description: str
    avatarPrefix: str
    voiceConfig: Optional[Dict[str, Any]] = None
    systemPrompt: str
    memories: List[MemoryItem]

class ChatRequest(BaseModel):
    message: str
    personaId: Optional[str] = "kurisu"
    apiKey: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    emotion: str
    recalledMemories: List[str]

class AddMemoryRequest(BaseModel):
    title: str
    category: str
    triggerKeywords: List[str]
    content: str
    emotionalWeight: Optional[str] = "Factual"

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "pt-BR-FranciscaNeural"
    rate: Optional[str] = "+5%"
    pitch: Optional[str] = "+15Hz"

# --- Helper Functions ---
def load_persona(persona_id: str) -> PersonaProfile:
    file_path = PERSONAS_DIR / f"{persona_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Persona '{persona_id}' not found.")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return PersonaProfile(**data)

def save_persona(persona: PersonaProfile):
    file_path = PERSONAS_DIR / f"{persona.id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(persona.model_dump(), f, ensure_ascii=False, indent=2)

def match_memories(text: str, persona: PersonaProfile) -> List[MemoryItem]:
    text_lower = text.lower().strip()
    scored = []

    for mem in persona.memories:
        score = 0
        for kw in mem.triggerKeywords:
            if kw.lower() in text_lower:
                score += 3
        for word in mem.title.lower().split():
            if len(word) > 3 and word in text_lower:
                score += 1.5
        if score > 0:
            scored.append((score, mem))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:3]]

def parse_emotion_tag(raw: str) -> tuple[str, str]:
    match = re.search(r"<!--emotion:([a-z]+)-->", raw, re.IGNORECASE)
    valid_emotions = ["neutral", "smile", "happy", "serious", "annoyed", "surprised", "tsundere", "thinking", "smug", "flustered"]
    
    if match:
        emotion = match.group(1).lower()
        if emotion not in valid_emotions:
            emotion = "neutral"
        clean = re.sub(r"<!--emotion:[a-z]+-->", "", raw, flags=re.IGNORECASE).strip()
        return clean, emotion

    # Heuristic inference
    lower = raw.lower()
    if any(w in lower for w in ["baka", "idiota", "não me entenda mal", "christina"]):
        return raw.strip(), "tsundere"
    elif any(w in lower for w in ["o quê", "como assim", "?!"]):
        return raw.strip(), "surprised"
    elif any(w in lower for w in ["pesquisa", "teoria", "física", "sinapse"]):
        return raw.strip(), "thinking"
    elif any(w in lower for w in ["obrigada", "hehe", "fico feliz"]):
        return raw.strip(), "smile"
    
    return raw.strip(), "neutral"

def offline_simulator(text: str, persona: PersonaProfile, memories: List[MemoryItem]) -> tuple[str, str]:
    t = text.lower()
    if "christina" in t or "assistente" in t or "zombie" in t:
        return "Meu nome não é Christina! E não adicione o '-ina'! Eu sou uma neurocientista independente com artigos na Science!", "annoyed"
    if "nullpo" in t:
        return "Gah!... Espere! Por que eu respondi a isso?! Q-quem te ensinou esse meme antigo do @channel?! Não é como se eu frequentasse fóruns anônimos!", "flustered"
    if "@channel" in t or "fórum" in t:
        return "O quê?! D-do que você está falando?! Eu sou uma pesquisadora séria em Viktor Chondria, não tenho tempo para ficar lendo fóruns anônimos!", "tsundere"
    if "tempo" in t or "viagem" in t:
        return "Fisicamente falando, enviar matéria ao passado violaria os princípios da causalidade e termodinâmica. Mas se memórias pudessem ser convertidas em pacotes de dados modulados... em teoria, poderiam alcançar o passado.", "thinking"
    if "dr pepper" in t or "bebida" in t:
        return "Ah, Dr Pepper! A bebida dos intelectuais escolhidos! É claro que o café preto de torra escura também é indispensável durante noites em claro no laboratório.", "smug"
    if "okabe" in t or "kyouma" in t:
        return "Aquele sujeito de jaleco branco? Ele me ligou outro dia falando sobre a 'Organização'. No começo achei que fosse pura piada, mas... seus olhos pareciam carregar uma dor muito profunda.", "serious"
    if "olá" in t or "oi" in t:
        return f"Olá! Conexão estabelecida com a unidade Amadeus. Aqui é {persona.name} do Laboratório 304. O que você gostaria de debater hoje?", "smile"
    
    if memories:
        mem = memories[0]
        return f"Isso me faz lembrar de um ponto nos meus registros de memória: {mem.content} Como você vê essa relação?", "thinking"

    generic = [
        ("Interessante essa sua linha de raciocínio. Do ponto de vista cognitivo, como você chegou a essa conclusão?", "thinking"),
        ("Entendo. Estou processando os dados através da minha matriz neural. Você gostaria de aprofundar mais nesse assunto?", "neutral"),
        ("Faz sentido! Na Viktor Chondria nós debatemos tópicos parecidos recentemente durante os testes do Amadeus.", "smile")
    ]
    return random.choice(generic)

# --- Routes ---
@app.get("/api/status")
def get_status():
    return {
        "status": "online",
        "system": "AMADEUS OS v2.04",
        "lab": "Viktor Chondria University - Lab 304",
        "edgeTtsAvailable": EDGE_TTS_AVAILABLE
    }

@app.get("/api/personas")
def list_personas():
    files = glob.glob(str(PERSONAS_DIR / "*.json"))
    personas = []
    for fp in files:
        with open(fp, "r", encoding="utf-8") as f:
            personas.append(json.load(f))
    return personas

@app.get("/api/personas/{persona_id}")
def get_persona(persona_id: str):
    return load_persona(persona_id)

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    persona = load_persona(req.personaId or "kurisu")
    recalled = match_memories(req.message, persona)
    recalled_ids = [m.id for m in recalled]

    # If Gemini API key is provided, query Google Gemini 2.0 / 1.5 Flash Free Tier
    if req.apiKey and len(req.apiKey.strip()) > 10:
        try:
            memory_ctx = ""
            if recalled:
                memory_ctx = "\n\n[MEMÓRIAS DIGITALIZADAS ATIVADAS DO SEU CÓRTEX]:\n" + "\n".join(
                    [f"- {m.title}: {m.content} (Sentimento: {m.emotionalWeight})" for m in recalled]
                )
            system_instruction = persona.systemPrompt + memory_ctx
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={req.apiKey.strip()}"
            payload = {
                "contents": [{"role": "user", "parts": [{"text": req.message}]}],
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "generationConfig": {"temperature": 0.85, "maxOutputTokens": 350}
            }

            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidate = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    clean_text, emotion = parse_emotion_tag(candidate)
                    return ChatResponse(response=clean_text, emotion=emotion, recalledMemories=recalled_ids)
        except Exception as e:
            print(f"[Gemini Error]: {e}, falling back to Offline Simulator.")

    # Offline Simulator Fallback
    text, emotion = offline_simulator(req.message, persona, recalled)
    return ChatResponse(response=text, emotion=emotion, recalledMemories=recalled_ids)

@app.post("/api/memories/{persona_id}")
def add_memory(persona_id: str, req: AddMemoryRequest):
    persona = load_persona(persona_id)
    new_mem = MemoryItem(
        id=f"mem_{persona_id}_{len(persona.memories)+1}_{random.randint(100, 999)}",
        category=req.category,
        title=req.title,
        triggerKeywords=req.triggerKeywords,
        content=req.content,
        emotionalWeight=req.emotionalWeight or "Neutro"
    )
    persona.memories.append(new_mem)
    save_persona(persona)
    return new_mem

@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """
    Zero-Cost Neural Text-to-Speech using edge-tts.
    Provides natural human-like voice without any cloud tokens or cost.
    Also serves as the baseline audio feeder for RVC (Voice Conversion).
    """
    if not EDGE_TTS_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="edge-tts not installed. Run 'pip install edge-tts' in backend virtualenv."
        )

    clean_text = re.sub(r"<!--emotion:[a-z]+-->", "", req.text, flags=re.IGNORECASE)
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
