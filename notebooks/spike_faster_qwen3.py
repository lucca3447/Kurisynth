#!/usr/bin/env python3
"""
========================================================================================
 🔬 OpenAmadeus Companion — Kurisu Qwen3-TTS Latency & Streaming Spike (Fase 0)
========================================================================================

Este script realiza o benchmark empírico comparativo do Qwen3-TTS acelerado com CUDA Graphs
(`faster-qwen3-tts`) usando o checkpoint oficial de Makise Kurisu (`starrydark/Kurisu_Qwen3_TTS`).

Métricas Aferidas (ML Best Practices):
 1. TTFA (Time to First Audio): Latência até o primeiro chunk jogável em milissegundos.
 2. RTF (Real-Time Factor): Duração do áudio gerado / Tempo de computação (RTF > 1.0 = mais rápido que tempo real).
 3. Throughput & Qualidade: Geração contínua sem truncamento fonético.
 4. Streaming via Túnel Cloudflare: Validação de transmissão contínua sem buffering intermediário.
 5. Comparação A/B de Áudio: Gravação de WAVs para validação de prosódia e timbre.
========================================================================================
"""

import os
import sys
import time
import io
import asyncio
import numpy as np
import soundfile as sf
import torch

# --------------------------------------------------------------------------------------
# 1. Checagem de Ambiente & Hardware
# --------------------------------------------------------------------------------------
print("=" * 75)
print(" 🔬 INICIANDO SPIKE: Qwen3-TTS Kurisu com CUDA Graphs & Streaming")
print("=" * 75)

if not torch.cuda.is_available():
    print("❌ ERRO CRÍTICO: CUDA não disponível. Certifique-se de selecionar uma GPU no Colab (L4, A100, G4, etc.).")
    sys.exit(1)

device_name = torch.cuda.get_device_name(0)
device_cap = torch.cuda.get_device_capability(0)
total_vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)

print(f"🎮 GPU Detectada: {device_name}")
print(f"📊 Compute Capability: {device_cap[0]}.{device_cap[1]} | VRAM Total: {total_vram_gb:.2f} GB")
print(f"🐍 PyTorch: {torch.__version__} | CUDA: {torch.version.cuda}")

# Auto-seleção de precisão numérica
if device_cap[0] >= 8:
    dtype_selected = torch.bfloat16
    dtype_str = "bfloat16"
else:
    dtype_selected = torch.float16
    dtype_str = "float16"
print(f"⚡ Precisão Selecionada: {dtype_str}")

# --------------------------------------------------------------------------------------
# 2. Instalação e Importação do Runtime
# --------------------------------------------------------------------------------------
try:
    from faster_qwen3_tts import FasterQwen3TTS
    print("✅ Biblioteca 'faster_qwen3_tts' já instalada.")
except ImportError:
    print("📦 Instalando 'faster-qwen3-tts' e dependências de áudio/túnel...")
    os.system("pip install -q faster-qwen3-tts pycloudflared soundfile fastapi uvicorn httpx")
    from faster_qwen3_tts import FasterQwen3TTS

# --------------------------------------------------------------------------------------
# 3. Carregamento do Modelo Kurisu
# --------------------------------------------------------------------------------------
MODEL_ID = "starrydark/Kurisu_Qwen3_TTS"
SPEAKER = "kurisu"
LANGUAGE = "Portuguese"

print(f"\n⏳ Carregando modelo '{MODEL_ID}' com CUDA Graphs...")
t0_load = time.perf_counter()

model = FasterQwen3TTS.from_pretrained(
    MODEL_ID,
    device="cuda:0",
    dtype=dtype_selected,
    attn_implementation="sdpa",
    max_seq_len=2048,
)
load_elapsed = time.perf_counter() - t0_load
print(f"✅ Modelo carregado na GPU em {load_elapsed:.2f}s!")

print("🔥 Realizando Warm-up e Captura de CUDA Graphs...")
t0_warm = time.perf_counter()
model.warmup(prefill_len=100)
warm_elapsed = time.perf_counter() - t0_warm
print(f"✅ CUDA Graphs capturados com sucesso em {warm_elapsed:.2f}s!")

# --------------------------------------------------------------------------------------
# 4. Suíte de Benchmark de Prosódia & Latência (3 Utterances Canônicas)
# --------------------------------------------------------------------------------------
TEST_SUITE = [
    {
        "id": "curta",
        "label": "Curta (Hesitação Tsundere)",
        "text": "Não precisa me envergonhar assim... Lucca seu idiota!",
        "instruct": "Português brasileiro, som seco e direto sem eco. Tom tsundere, voz jovem da Kurisu, fingindo irritação mas envergonhada.",
    },
    {
        "id": "media",
        "label": "Média (Diálogo Enfático)",
        "text": "O que você está olhando com essa cara presunçosa?! Eu sou uma pesquisadora em Viktor Chondria, não tire conclusões precipitadas!",
        "instruct": "Português brasileiro, som seco e direto sem eco. Tom defensivo e inteligente, voz articulada.",
    },
    {
        "id": "longa",
        "label": "Longa (Discussão Científica)",
        "text": "A teoria dos saltos temporais de Kerr tem limitações claras quando consideramos a conservação do horizonte de eventos da singularidade nua. Você ao menos considerou o paradoxo temporal inerente a essa transmissão, Okabe?",
        "instruct": "Português brasileiro, som seco e direto sem eco. Tom analítico, firme e focado em raciocínio lógico.",
    },
]

OUTPUT_DIR = os.path.join(os.getcwd(), "spike_output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

results = []

print("\n" + "=" * 75)
print(" 🎙️ INICIANDO TESTES DE SÍNTESE COM STREAMING (chunk_size=8)")
print("=" * 75)

for item in TEST_SUITE:
    tid = item["id"]
    tlabel = item["label"]
    ttext = item["text"]
    tinstruct = item["instruct"]

    print(f"\n▶ [{tlabel}]")
    print(f"   Texto ({len(ttext)} chars): \"{ttext}\"")

    t_start = time.perf_counter()
    ttfa = None
    chunks_pcm = []
    chunk_timings = []
    sr_used = 24000

    # Chamada com streaming acelerado por CUDA Graphs
    stream_gen = model.generate_custom_voice_streaming(
        text=ttext,
        speaker=SPEAKER,
        language=LANGUAGE,
        instruct=tinstruct,
        chunk_size=8,  # 8 passos ~= 667ms de áudio por pacote
        temperature=0.75,
        top_p=0.95,
        repetition_penalty=1.05,
    )

    for i, (audio_chunk, sr, timing) in enumerate(stream_gen):
        sr_used = sr
        if ttfa is None:
            ttfa = (time.perf_counter() - t_start) * 1000.0  # Em ms
            print(f"   ⚡ Primeiro chunk gerado (TTFA): {ttfa:.1f} ms! (Chunk #{i+1}, {len(audio_chunk)} amostras)")
        chunks_pcm.append(audio_chunk)
        chunk_timings.append(timing)

    total_gen_time = time.perf_counter() - t_start
    full_audio = np.concatenate(chunks_pcm) if chunks_pcm else np.zeros(1, dtype=np.float32)
    audio_duration_sec = len(full_audio) / float(sr_used)
    rtf = audio_duration_sec / total_gen_time if total_gen_time > 0 else 0.0

    # Salva áudio WAV PCM16
    out_path = os.path.join(OUTPUT_DIR, f"fast_{tid}.wav")
    sf.write(out_path, full_audio, sr_used, subtype="PCM_16")

    print(f"   ⏱️ Tempo total de computação: {total_gen_time:.2f} s")
    print(f"   🎵 Duração do áudio: {audio_duration_sec:.2f} s")
    print(f"   🚀 Fator de Tempo Real (RTF): {rtf:.2f}x ({'Superando tempo real!' if rtf > 1.0 else 'Abaixo de tempo real'})")
    print(f"   💾 Áudio salvo em: {out_path}")

    results.append({
        "id": tid,
        "label": tlabel,
        "chars": len(ttext),
        "ttfa_ms": round(ttfa or 0.0, 1),
        "total_time_s": round(total_gen_time, 2),
        "audio_dur_s": round(audio_duration_sec, 2),
        "rtf": round(rtf, 2),
        "file": out_path,
    })

# --------------------------------------------------------------------------------------
# 5. Teste de Transmissão Streaming via Túnel Cloudflare
# --------------------------------------------------------------------------------------
print("\n" + "=" * 75)
print(" 🌐 TESTE DE STREAMING HTTP OVER CLOUDFLARE TUNNEL")
print("=" * 75)

import threading
import httpx
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import uvicorn
from pycloudflared import try_cloudflare

tunnel_app = FastAPI(title="Spike Streaming Server")

@tunnel_app.post("/stream_test")
async def stream_test_endpoint():
    async def pcm_generator():
        # Gera frase de teste curta em streaming
        stream = model.generate_custom_voice_streaming(
            text="Túnel Cloudflare conectado e operando em streaming contínuo!",
            speaker=SPEAKER,
            language=LANGUAGE,
            instruct="Voz clara e direta.",
            chunk_size=8,
        )
        for audio_chunk, sr, _ in stream:
            # Converte float32 para PCM16 bytes
            pcm16 = (np.clip(audio_chunk, -1.0, 1.0) * 32767).astype(np.int16).tobytes()
            yield pcm16

    return StreamingResponse(pcm_generator(), media_type="audio/L16;rate=24000")

def run_mini_server():
    uvicorn.run(tunnel_app, host="127.0.0.1", port=8015, log_level="error")

server_thread = threading.Thread(target=run_mini_server, daemon=True)
server_thread.start()
time.sleep(1.0)

print("🚇 Abrindo túnel Cloudflare na porta 8015...")
tunnel = try_cloudflare(port=8015)
tunnel_url = tunnel.tunnel if hasattr(tunnel, 'tunnel') else str(tunnel)
print(f"👉 URL do Túnel: {tunnel_url}")

async def test_tunnel_latency():
    print("📡 Disparando requisição de teste através do túnel público...")
    t0 = time.perf_counter()
    ttfb = None
    chunks_received = 0
    total_bytes = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            async with client.stream("POST", f"{tunnel_url}/stream_test") as response:
                async for chunk in response.aiter_bytes():
                    if ttfb is None:
                        ttfb = (time.perf_counter() - t0) * 1000.0
                        print(f"   ⚡ Primeiro byte via Cloudflare (TTFB): {ttfb:.1f} ms!")
                    chunks_received += 1
                    total_bytes += len(chunk)
            print(f"   ✅ Stream completo recebido via túnel: {total_bytes} bytes ({chunks_received} pacotes de rede).")
            return ttfb
        except Exception as e:
            print(f"   ⚠️ Erro ao sondar túnel: {e}")
            return None

loop = asyncio.new_event_loop()
tunnel_ttfb = loop.run_until_complete(test_tunnel_latency())
loop.close()

# --------------------------------------------------------------------------------------
# 6. Relatório Consolidado de Desempenho (ML Best Practices)
# --------------------------------------------------------------------------------------
print("\n" + "=" * 75)
print(" 📊 RELATÓRIO FINAL DO SPIKE — QWEN3-TTS FASTER RUNTIME")
print("=" * 75)
print(f"GPU: {device_name} ({total_vram_gb:.1f} GB) | Dtype: {dtype_str}")
print("-" * 75)
print(f"{'Caso de Teste':<25} | {'Chars':<6} | {'TTFA (Local)':<12} | {'Áudio (s)':<10} | {'Tempo (s)':<10} | {'RTF':<6}")
print("-" * 75)
for r in results:
    print(f"{r['label']:<25} | {r['chars']:<6} | {r['ttfa_ms']} ms{'':<5} | {r['audio_dur_s']} s{'':<5} | {r['total_time_s']} s{'':<5} | {r['rtf']}x")
print("-" * 75)
if tunnel_ttfb:
    print(f"🌐 Latência de Rede via Túnel Cloudflare (Time-to-first-byte): {tunnel_ttfb:.1f} ms")
print(f"📁 Arquivos WAV gerados para avaliação de escuta em: {OUTPUT_DIR}")
print("=" * 75)
print("🏁 Spike concluído! Copie a tabela acima e compartilhe os resultados para validação.")
