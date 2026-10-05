# 🐍 Amadeus Backend (FastAPI + Python)

Servidor backend em Python para o **Amadeus System**:
- Gerenciamento de personas e memórias digitalizadas em JSON modular (`server/personas/`).
- RAG local para busca de sinapses contextuais.
- Conexão com Google Gemini Flash (Free Tier) e Simulador Offline Autônomo.
- Rota de voz neural gratuita via `edge-tts` (preparada para pipeline de clonagem RVC).

---

## Como Iniciar o Backend

1. Crie e ative o ambiente virtual:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```

2. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

3. Inicie o servidor FastAPI:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

O backend estará ativo em `http://localhost:8000` (documentação interativa Swagger em `http://localhost:8000/docs`).
