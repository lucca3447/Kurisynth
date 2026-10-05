# Kurisu Fine-Tuning Pack (Amadeus Edition)

Este pacote contém tudo o que é necessário para treinar, executar e injetar a personalidade autêntica de **Makise Kurisu (Amadeus)** de *Steins;Gate 0*.

## Arquivos do Pacote

- `kurisu_finetuning_dataset_enhanced.jsonl`: **63 pares de conversas refinadas** no formato ChatML/OpenAI com prompt de sistema, emoções visuais (`<!--emotion:xxx-->`) e auto-memorização (`<!--remember:...-->`).
- `kurisu_finetuning_dataset.jsonl`: Dataset base com 50 turnos de conversação.
- `kurisu_finetuning_system.md`: Bíblia completa de persona, tom, dinâmica de relacionamentos, epistemologia científica e anti-caricatura.
- `kurisu_memory.json`: Estrutura canônica de memórias, termos científicos e regras de linha de mundo.
- `unsloth_finetuning.py`: Script pronto para treinar via LoRA no Google Colab (GPU T4 gratuita) em ~15 minutos.
- `Modelfile`: Arquivo para criar o modelo local no Ollama com 1 comando: `ollama create amadeus-kurisu -f Modelfile`.

---

## Como Executar o Fine-Tuning (3 Maneiras)

### Método 1: Google Colab (100% Gratuito com GPU T4)
1. Abra um notebook no [Google Colab](https://colab.research.google.com/) e selecione **Ambiente de Execução > T4 GPU**.
2. Faça upload de `unsloth_finetuning.py` e `kurisu_finetuning_dataset_enhanced.jsonl`.
3. Execute:
   ```bash
   pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
   pip install --no-deps "xformers<0.0.27" trl peft accelerate bitsandbytes
   python unsloth_finetuning.py
   ```
4. Em ~15 minutos, seu modelo LoRA estará treinado e pronto para download ou exportação em GGUF.

### Método 2: Ollama Local (Sem necessidade de treinar)
1. Instale o [Ollama](https://ollama.com).
2. Na pasta `server/kurisu_finetuning_pack`, execute:
   ```bash
   ollama create amadeus-kurisu -f Modelfile
   ollama run amadeus-kurisu
   ```

### Método 3: Dynamic Few-Shot RAG no Amadeus (Automático no App!)
O servidor Amadeus (`server/main.py` + `server/memory_store.py`) já indexa automaticamente os exemplos deste dataset no ChromaDB. Cada mensagem enviada pelo usuário resgata dinamicamente os diálogos mais relevantes do dataset e os injeta no prompt do LLM, fazendo com que qualquer modelo gratuito (Gemma 4, LFM, Gemini) responda com o mesmo estilo e autenticidade de um modelo com fine-tuning!
