# 🧠 AMADEUS SYSTEM // Steins;Gate 0

> *"Amadeus is an artificial intelligence system that digitizes and reproduces human memories and personality."*  
> — Victor Chondria University Neuroscience Lab 304

Uma aplicação web interativa de alta fidelidade que recria o **Sistema Amadeus** do anime e visual novel *Steins;Gate 0*. Acompanha os 174 sprites visuais originais da personagem **Makise Kurisu**, animações de sincronia labial (*lip-sync*), ciclo orgânico de piscar de olhos, osciloscópio de frequências de áudio em tempo real, banco de memórias cognitivas digitalizadas e suporte a voz e microfone com **Custo Zero (R$ 0,00)**.

---

## ⚡ Funcionalidades

- 📞 **Interface de Videochamada Fiel**:
  - Tela de chamada recebida com radar e aviso de conexão de Viktor Chondria.
  - Monitor sci-fi com relógio de chamada, status de conexão criptografada e sinal verde de laboratório.
  - Efeito opcional de linhas de varredura CRT (*scanlines*).
- 🎭 **Sprites Originais do Jogo (174 Assets)**:
  - Expressões dinâmicas: neutra, sorriso, feliz, séria/cientista, tsundere corada, pensativa com a mão no queixo, surpresa, irritada.
  - **Lip-Sync**: A boca alterna entre aberto e fechado enquanto ela fala.
  - **Piscar de Olhos Orgânico**: Pisca realisticamente a cada 3 a 5 segundos.
- 🌊 **Osciloscópio de Frequência**: Canvas animado renderizando a onda senoidal de áudio do Amadeus sincronizada com a fala e o microfone.
- 🧠 **Córtex de Memórias Digitalizadas (RAG Local)**:
  - Recupera memórias factuais e episódicas da Kurisu conforme o contexto da conversa.
  - Inspetor de memórias com opção de criar e injetar novas memórias digitalizadas.
- 🎙️ **Voz e Microfone Nativos (100% Gratuitos)**:
  - **STT (Speech-to-Text)**: Fale pelo microfone sem gastar tokens ou dinheiro.
  - **TTS (Text-to-Speech)**: Ela responde falando com as vozes instaladas no seu sistema.
- 💡 **Motor Híbrido Custo Zero**:
  - **Gemini Free Tier**: Suporte opcional à chave gratuita do Google AI Studio.
  - **Simulador Offline Autônomo**: Funciona mesmo sem internet ou sem nenhuma chave configurada.

---

## 🚀 Como Executar

### 1. Instalar as dependências
Abra o terminal na pasta do projeto e execute:
```bash
npm install
```

### 2. Iniciar a aplicação
```bash
npm run dev
```

Abra o link exibido no terminal (geralmente `http://localhost:5173`) no seu navegador (Google Chrome, Edge ou Brave recomendados para suporte total à Web Speech API).

---

## 🌐 Git & Repositório Remoto

O repositório local já está configurado com a branch `main` e o remoto:
`https://github.com/lucca3447/amadeus.git`

Para commitar e enviar suas alterações para o GitHub:
```bash
git add .
git commit -m "feat: Amadeus system with 174 original Kurisu sprites and audio oscilloscope"
git push -u origin main
```
