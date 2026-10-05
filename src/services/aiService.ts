import { ChatMessage, Emotion, MemoryItem, PersonaProfile } from '../types/amadeus';
import { BackendService } from './backendService';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Preferred Gemini models, in order. Prioritizing 2.5 and 1.5 avoids the temporary 503 spike on 3.8.
const PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

export function isOpenRouterKey(key: string): boolean {
  return key.trim().startsWith('sk-or-');
}

const MODEL_CACHE_KEY = 'amadeus_model';
const MODEL_CACHE_FINGERPRINT = 'amadeus_model_key_fp';
const MAX_HISTORY_MESSAGES = 20;

const VALID_EMOTIONS: Emotion[] = [
  'neutral', 'smile', 'happy', 'serious', 'annoyed',
  'surprised', 'tsundere', 'thinking', 'smug', 'flustered',
];

export type AIStatus =
  | { kind: 'offline' }
  | { kind: 'pending' }
  | { kind: 'online'; model: string }
  | { kind: 'error'; message: string };

export interface LearnedMemoryInfo {
  title: string;
  content: string;
  emotionalWeight?: string;
}

export interface AIResult {
  response: string;
  emotion: Emotion;
  status: AIStatus;
  /** true when the response is an error report, not something Amadeus "said" */
  isError: boolean;
  learnedMemory?: LearnedMemoryInfo;
  sessionId?: string;
}

/** Error from the Gemini API, carrying the HTTP status (0 = network / empty response). */
export class GeminiError extends Error {
  constructor(public code: number, public apiMessage: string) {
    super(`Gemini API error ${code}: ${apiMessage}`);
  }

  /** Short, user-facing explanation in Portuguese */
  get friendly(): string {
    switch (this.code) {
      case 400:
        return /api key/i.test(this.apiMessage)
          ? 'Chave de API inválida. Gere uma nova no Google AI Studio e cole sem espaços.'
          : `Requisição recusada pela Google: ${this.apiMessage}`;
      case 401:
      case 403:
        return 'A chave não tem permissão para usar a Gemini API (verifique se a API está ativada no seu projeto).';
      case 404:
        return `Modelo não encontrado: ${this.apiMessage}`;
      case 429:
        return 'Cota temporária atingida. Aguarde alguns instantes.';
      case 503:
        return 'Os servidores do Google estão temporariamente sobrecarregados neste modelo (Erro 503).';
      case 0:
        return this.apiMessage;
      default:
        return this.code >= 500
          ? `Servidores do Google temporariamente indisponíveis (Código ${this.code}).`
          : this.apiMessage;
    }
  }
}

function keyFingerprint(apiKey: string): string {
  return apiKey.slice(-8);
}

async function geminiFetch(path: string, apiKey: string, body?: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GeminiError(0, 'Sem conexão com a Google. Verifique sua internet.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new GeminiError(res.status, data?.error?.message || res.statusText || 'Erro desconhecido');
  }
  return res.json();
}

/** Ranks a model name: newer version first, full models before lite/preview/experimental. */
function scoreModel(name: string): number {
  const match = name.match(/gemini-(\d+(?:\.\d+)?)/);
  const version = match ? parseFloat(match[1]) : 0;
  let score = version * 100;
  if (name.includes('lite')) score -= 30;
  if (name.includes('preview') || name.includes('exp')) score -= 10;
  return score;
}

export class AIService {
  static clearModelCache(): void {
    localStorage.removeItem(MODEL_CACHE_KEY);
    localStorage.removeItem(MODEL_CACHE_FINGERPRINT);
  }

  /**
   * Queries the ListModels endpoint using the user's key to find which models
   * this specific key is allowed to call, ranked by version and stability.
   */
  static async getCandidateModels(apiKey: string, forceRefresh = false): Promise<string[]> {
    const cached = localStorage.getItem(MODEL_CACHE_KEY);
    const cachedFp = localStorage.getItem(MODEL_CACHE_FINGERPRINT);
    const fp = keyFingerprint(apiKey);

    const data = await geminiFetch('models?pageSize=1000', apiKey);
    const rawList: any[] = Array.isArray(data?.models) ? data.models : [];

    const usable = rawList
      .filter(
        (m) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          typeof m.name === 'string' &&
          m.name.replace('models/', '').startsWith('gemini') &&
          !/tts|image|audio|live|embedding/i.test(m.name)
      )
      .map((m) => m.name.replace('models/', ''));

    if (usable.length === 0) {
      throw new GeminiError(404, 'Nenhum modelo de chat disponível para esta chave.');
    }

    const candidates: string[] = [];

    if (!forceRefresh && cached && cachedFp === fp && usable.includes(cached)) {
      candidates.push(cached);
    }

    for (const pref of PREFERRED_MODELS) {
      if (usable.includes(pref) && !candidates.includes(pref)) {
        candidates.push(pref);
      }
    }

    const flashModels = usable.filter((m) => m.includes('flash') && !candidates.includes(m));
    flashModels.sort((a, b) => scoreModel(b) - scoreModel(a));
    candidates.push(...flashModels);

    const remaining = usable.filter((m) => !candidates.includes(m));
    remaining.sort((a, b) => scoreModel(b) - scoreModel(a));
    candidates.push(...remaining);

    return candidates;
  }

  /**
   * Tests whether the provided API key is valid.
   */
  static async testConnection(apiKey: string): Promise<{ ok: boolean; model?: string; message: string }> {
    const key = apiKey.trim();
    if (!key) return { ok: false, message: 'Cole uma chave antes de testar.' };

    // Check if OpenRouter key
    if (isOpenRouterKey(key)) {
      const candidates = [
        'nvidia/nemotron-3.5-lightning:free',
        'google/gemma-4-31b-it:free',
        'google/gemma-4-26b-a4b-it:free',
        'liquid/lfm-2.5-2.6b:free',
        'nvidia/nemotron-3-super-120b-a12b:free',
        'nvidia/nemotron-3-ultra-550b-a55b:free',
      ];
      let lastErr: any = null;

      for (const model of candidates) {
        try {
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${key}`,
              'HTTP-Referer': 'http://localhost:5173',
              'X-Title': 'Amadeus System',
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 10,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = errData?.error?.message || res.statusText || 'Erro no OpenRouter';
            const isRetryable =
              res.status === 404 ||
              res.status === 429 ||
              res.status === 502 ||
              res.status === 503 ||
              msg.toLowerCase().includes('unavailable for free') ||
              msg.toLowerCase().includes('rate-limited');

            if (isRetryable) {
              console.warn(`[Amadeus] OpenRouter model ${model} returned ${res.status}, testing next...`);
              continue;
            }
            throw new GeminiError(res.status, msg);
          }

          localStorage.setItem('amadeus_openrouter_model', model);
          const cleanName = model.replace(':free', '');
          return { ok: true, model: `${cleanName} (OpenRouter)`, message: `Conectado ao OpenRouter (${cleanName})!` };
        } catch (err: any) {
          lastErr = err;
          if (err instanceof GeminiError && (err.code === 404 || err.code === 429 || err.code === 502 || err.code === 503)) continue;
          break;
        }
      }

      const message = lastErr instanceof GeminiError ? `[${lastErr.code || 'REDE'}] ${lastErr.apiMessage}` : String(lastErr);
      return { ok: false, message };
    }

    try {
      const candidates = await this.getCandidateModels(key, true);
      let lastErr: any = null;

      for (const model of candidates) {
        try {
          await geminiFetch(`models/${model}:generateContent`, key, {
            contents: [{ role: 'user', parts: [{ text: 'Responda apenas: ok' }] }],
            generationConfig: { maxOutputTokens: 100 },
          });

          localStorage.setItem(MODEL_CACHE_KEY, model);
          localStorage.setItem(MODEL_CACHE_FINGERPRINT, keyFingerprint(key));
          return { ok: true, model, message: `Conectado: ${model}` };
        } catch (err: any) {
          lastErr = err;
          if (err instanceof GeminiError && (err.code === 503 || err.code === 429 || err.code === 404)) {
            console.warn(`[Amadeus] Test model ${model} returned ${err.code}, testing next candidate...`);
            continue;
          }
          break;
        }
      }

      const message = lastErr instanceof GeminiError ? `[${lastErr.code || 'REDE'}] ${lastErr.friendly}` : String(lastErr);
      return { ok: false, message };
    } catch (err) {
      const message = err instanceof GeminiError ? `[${err.code || 'REDE'}] ${err.friendly}` : String(err);
      return { ok: false, message };
    }
  }

  /**
   * Main entry point with Hybrid Architecture:
   * 1. Try Python Backend (FastAPI + ChromaDB + SQLite) if running.
   * 2. Otherwise run pure client-side (OpenRouter / Gemini / Offline).
   */
  static async queryAmadeus(
    userMessage: string,
    persona: PersonaProfile,
    recalledMemories: MemoryItem[],
    apiKey: string | undefined,
    history: ChatMessage[] = [],
    sessionId: string | null = null
  ): Promise<AIResult> {
    const key = apiKey?.trim();

    // 1. Try Python Backend if available
    const backendOnline = await BackendService.checkHealth();
    if (backendOnline) {
      try {
        const backendRes = await BackendService.queryChat(userMessage, sessionId, key || '', history);
        return {
          response: backendRes.response,
          emotion: backendRes.emotion,
          status: { kind: 'online', model: backendRes.model || 'ChromaDB + SQLite (Python)' },
          isError: Boolean(backendRes.error),
          learnedMemory: backendRes.learnedMemory,
          sessionId: backendRes.sessionId,
        };
      } catch (err) {
        console.warn('[Amadeus] Local Python Backend failed, falling back to browser-mode:', err);
      }
    }

    // 2. Browser-Mode Fallback: No key -> offline simulator.
    if (!key) {
      const offline = this.queryOfflineSimulator(userMessage, persona, recalledMemories);
      return { ...offline, status: { kind: 'offline' }, isError: false };
    }

    // 3. Browser-Mode: OpenRouter
    if (isOpenRouterKey(key)) {
      try {
        const { response, emotion, model, learnedMemory } = await this.queryOpenRouter(userMessage, persona, recalledMemories, key, history);
        return { response, emotion, status: { kind: 'online', model }, isError: false, learnedMemory };
      } catch (err) {
        console.error('[Amadeus] OpenRouter call failed:', err);
        const message = err instanceof GeminiError
          ? `[ERRO ${err.code || 'REDE'}] ${err.friendly}`
          : `[ERRO] ${String(err)}`;
        return { response: message, emotion: 'serious', status: { kind: 'error', message }, isError: true };
      }
    }

    // 4. Browser-Mode: Google Gemini
    try {
      const { response, emotion, model, learnedMemory } = await this.queryGemini(userMessage, persona, recalledMemories, key, history);
      return { response, emotion, status: { kind: 'online', model }, isError: false, learnedMemory };
    } catch (err) {
      console.error('[Amadeus] Gemini call failed:', err);
      const message = err instanceof GeminiError
        ? `[ERRO ${err.code || 'REDE'}] ${err.friendly}`
        : `[ERRO] ${String(err)}`;
      return { response: message, emotion: 'serious', status: { kind: 'error', message }, isError: true };
    }
  }

  private static formatMemoryContext(recalledMemories: MemoryItem[]): string {
    const kurisuMemories = recalledMemories.filter((m) => m.source !== 'learned');
    const userMemories = recalledMemories.filter((m) => m.source === 'learned');

    const blocks: string[] = [];

    if (kurisuMemories.length > 0) {
      blocks.push(
        `[MEMÓRIAS DIGITALIZADAS ATIVADAS DO SEU CÓRTEX]:\n` +
          kurisuMemories.map((m) => `- ${m.title}: ${m.content} (Sentimento associado: ${m.emotionalWeight || 'Factual'})`).join('\n')
      );
    }

    if (userMemories.length > 0) {
      blocks.push(
        `[FATOS CONHECIDOS SOBRE O INTERLOCUTOR (SEU OPERADOR)]:\n` +
          userMemories.map((m) => `- ${m.title}: ${m.content}`).join('\n')
      );
    }

    return blocks.length > 0 ? `\n\n${blocks.join('\n\n')}` : '';
  }

  private static async queryOpenRouter(
    userMessage: string,
    persona: PersonaProfile,
    recalledMemories: MemoryItem[],
    apiKey: string,
    history: ChatMessage[]
  ): Promise<{ response: string; emotion: Emotion; model: string; learnedMemory?: LearnedMemoryInfo }> {
    const memoryContext = this.formatMemoryContext(recalledMemories);
    const systemPrompt = `${persona.systemPrompt}${memoryContext}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-MAX_HISTORY_MESSAGES).map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.emotion ? `${msg.content} <!--emotion:${msg.emotion}-->` : msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const cachedModel = localStorage.getItem('amadeus_openrouter_model');
    // If cached model is a pure reasoning model like nemotron-3-super, do not prioritize it
    const validCache = cachedModel && !cachedModel.includes('super') ? cachedModel : null;

    const candidates = [
      ...(validCache ? [validCache] : []),
      'nvidia/nemotron-3.5-lightning:free',
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'liquid/lfm-2.5-2.6b:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
    ].filter((v, i, a) => a.indexOf(v) === i);

    let lastErr: any = null;

    for (const model of candidates) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:5173',
            'X-Title': 'Amadeus System',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.85,
            max_tokens: 1024,
            include_reasoning: false,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const msg = errData?.error?.message || res.statusText || 'Erro OpenRouter';
          const isRetryable =
            res.status === 404 ||
            res.status === 429 ||
            res.status === 502 ||
            res.status === 503 ||
            msg.toLowerCase().includes('unavailable for free') ||
            msg.toLowerCase().includes('rate-limited');

          if (isRetryable) {
            console.warn(`[Amadeus] OpenRouter model ${model} returned ${res.status}, trying next candidate...`);
            continue;
          }
          throw new GeminiError(res.status, msg);
        }

        const data = await res.json();
        const choiceMsg = data.choices?.[0]?.message;
        const contentVal = choiceMsg?.content;
        // Strictly do NOT fallback to internal reasoning / thinking as spoken character dialogue
        const cleanContent = this.stripThinkingTags(typeof contentVal === 'string' ? contentVal : '');

        if (!cleanContent) {
          console.warn(`[Amadeus] OpenRouter model ${model} returned empty content or reasoning-only, trying next candidate...`);
          continue;
        }

        localStorage.setItem('amadeus_openrouter_model', model);
        const cleanName = model.replace(':free', '');
        return { ...this.parseResponseTags(cleanContent), model: `${cleanName} (OpenRouter)` };
      } catch (err: any) {
        lastErr = err;
        if (err instanceof GeminiError && (err.code === 404 || err.code === 429 || err.code === 502 || err.code === 503)) continue;
        throw err;
      }
    }

    if (lastErr) throw lastErr;
    throw new GeminiError(404, 'Nenhum modelo gratuito do OpenRouter respondeu.');
  }

  private static buildContents(history: ChatMessage[], userMessage: string) {
    const turns: { role: 'user' | 'model'; text: string }[] = [];

    for (const msg of history.slice(-MAX_HISTORY_MESSAGES)) {
      if (msg.sender === 'system') continue;
      const role = msg.sender === 'user' ? 'user' : 'model';
      const text = role === 'model' && msg.emotion
        ? `${msg.content} <!--emotion:${msg.emotion}-->`
        : msg.content;

      const last = turns[turns.length - 1];
      if (last && last.role === role) {
        last.text += `\n${text}`;
      } else {
        turns.push({ role, text });
      }
    }

    while (turns.length > 0 && turns[0].role === 'model') turns.shift();

    turns.push({ role: 'user', text: userMessage });
    return turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
  }

  private static async queryGemini(
    userMessage: string,
    persona: PersonaProfile,
    recalledMemories: MemoryItem[],
    apiKey: string,
    history: ChatMessage[]
  ): Promise<{ response: string; emotion: Emotion; model: string; learnedMemory?: LearnedMemoryInfo }> {
    const memoryContext = this.formatMemoryContext(recalledMemories);

    const body = {
      contents: this.buildContents(history, userMessage),
      systemInstruction: { parts: [{ text: `${persona.systemPrompt}${memoryContext}` }] },
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1024,
      },
    };

    const candidates = await this.getCandidateModels(apiKey);
    let selectedModel = candidates[0];
    let data: any = null;
    let lastError: any = null;

    for (const candidateModel of candidates) {
      try {
        data = await geminiFetch(`models/${candidateModel}:generateContent`, apiKey, body);
        selectedModel = candidateModel;
        lastError = null;

        localStorage.setItem(MODEL_CACHE_KEY, candidateModel);
        localStorage.setItem(MODEL_CACHE_FINGERPRINT, keyFingerprint(apiKey));
        break;
      } catch (err: any) {
        lastError = err;
        if (err instanceof GeminiError && (err.code === 503 || err.code === 429 || err.code === 404)) {
          console.warn(`[Amadeus] Model ${candidateModel} returned ${err.code} (${err.apiMessage}). Trying next candidate...`);
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        throw err;
      }
    }

    if (lastError && !data) {
      throw lastError;
    }

    const model = selectedModel;

    const candidate = data.candidates?.[0];
    const text: string = (candidate?.content?.parts ?? [])
      .filter((p: any) => typeof p.text === 'string' && !p.thought)
      .map((p: any) => p.text)
      .join('')
      .trim();

    if (!text) {
      const reason = data.promptFeedback?.blockReason || candidate?.finishReason || 'desconhecido';
      throw new GeminiError(0, `A IA retornou uma resposta vazia (motivo: ${reason}).`);
    }

    return { ...this.parseResponseTags(text), model };
  }

  /**
   * Strips internal chain-of-thought blocks such as <think>, <thought>, or unclosed thinking
   */
  public static stripThinkingTags(rawText: string | null | undefined): string {
    if (!rawText) return '';
    let text = rawText;
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
    text = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    text = text.replace(/<think>[\s\S]*$/gi, '');
    text = text.replace(/<thought>[\s\S]*$/gi, '');
    text = text.replace(/<reasoning>[\s\S]*$/gi, '');
    text = text.replace(/\*{0,2}thinking(?:\s+process)?:\*{0,2}[\s\S]*?\n\n/gi, '');
    return text.trim();
  }

  /**
   * Extracts both emotion tag and remember tag from text
   */
  public static parseResponseTags(rawText: string | null | undefined): {
    response: string;
    emotion: Emotion;
    learnedMemory?: LearnedMemoryInfo;
  } {
    let emotion: Emotion = 'neutral';
    let cleanText = this.stripThinkingTags(rawText);
    let learnedMemory: LearnedMemoryInfo | undefined = undefined;

    if (!cleanText) {
      return { response: '', emotion: 'neutral' };
    }

    // 1. Extract remember tag: <!--remember:title|content|emotion-->
    const remMatch = cleanText.match(/<!--\s*remember:\s*(.*?)\|(.*?)\|(.*?)\s*-->/i);
    if (remMatch) {
      learnedMemory = {
        title: remMatch[1].trim(),
        content: remMatch[2].trim(),
        emotionalWeight: remMatch[3].trim() || 'Factual',
      };
      cleanText = cleanText.replace(/<!--\s*remember:.*?\s*-->/gi, '');
    }

    // 2. Extract emotion tag: <!--emotion:xxx-->
    const match = cleanText.match(/<!--\s*emotion:\s*([a-z]+)\s*-->/i);
    if (match && match[1]) {
      const parsed = match[1].toLowerCase() as Emotion;
      if (VALID_EMOTIONS.includes(parsed)) {
        emotion = parsed;
      }
      cleanText = cleanText.replace(/<!--\s*emotion:\s*[a-z]+\s*-->/gi, '');
    } else {
      // Inferred sentiment
      const lower = cleanText.toLowerCase();
      if (lower.includes('baka') || lower.includes('idiota') || lower.includes('não me entenda mal') || lower.includes('christina')) {
        emotion = 'tsundere';
      } else if (lower.includes('o quê') || lower.includes('como assim') || lower.includes('?!')) {
        emotion = 'surprised';
      } else if (lower.includes('pesquisa') || lower.includes('teoria') || lower.includes('física') || lower.includes('sinapse')) {
        emotion = 'thinking';
      } else if (lower.includes('obrigada') || lower.includes('hehe') || lower.includes('fico feliz')) {
        emotion = 'smile';
      } else if (lower.includes('concordo') || lower.includes('exatamente')) {
        emotion = 'happy';
      }
    }

    return { response: cleanText.trim(), emotion, learnedMemory };
  }

  /**
   * Smart Offline Simulator with auto-learning simulation
   */
  private static queryOfflineSimulator(
    userMessage: string,
    persona: PersonaProfile,
    recalledMemories: MemoryItem[]
  ): { response: string; emotion: Emotion; learnedMemory?: LearnedMemoryInfo } {
    const text = userMessage.toLowerCase().trim();

    // Check for user introduction to simulate learning in offline mode
    let learnedMemory: LearnedMemoryInfo | undefined = undefined;
    const introMatch = userMessage.match(/(?:meu nome é|me chamo|eu sou o|eu sou a)\s+([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+)/i);
    if (introMatch) {
      const name = introMatch[1].charAt(0).toUpperCase() + introMatch[1].slice(1);
      learnedMemory = {
        title: 'Nome do Operador',
        content: `O interlocutor se chama ${name}.`,
        emotionalWeight: 'Acolhimento amigável',
      };
    }

    const has = (...words: string[]) =>
      words.some((w) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(text));

    if (has('christina', 'zombie', 'assistente')) {
      const answers = [
        { response: 'Meu nome não é Christina! E não adicione o "-ina"! Por que você insiste em usar esses apelidos irritantes?!', emotion: 'annoyed' as Emotion },
        { response: 'Nem pense em me chamar de assistente de novo! Eu sou uma neurocientista independente com artigos na Science, seu idiota!', emotion: 'tsundere' as Emotion },
      ];
      return { ...answers[Math.floor(Math.random() * answers.length)], learnedMemory };
    }

    if (has('nullpo', 'nurupo')) {
      return {
        response: 'Gah!... Espere! Por que eu respondi a isso?! Q-quem te ensinou esse meme antigo do @channel?! Não é como se eu frequentasse fóruns anônimos!',
        emotion: 'flustered',
        learnedMemory,
      };
    }

    if (text.includes('@channel') || has('channeler', 'fórum', 'forum', 'kurigohan')) {
      return {
        response: 'O quê?! D-do que você está falando?! Eu sou uma pesquisadora séria em Viktor Chondria, não tenho tempo para ficar lendo fóruns anônimos na internet! Pare de inventar coisas absurdas!',
        emotion: 'tsundere',
        learnedMemory,
      };
    }

    if (has('okabe', 'hououin', 'kyouma', 'rintaro')) {
      return {
        response: 'Aquele sujeito com síndrome de cientista louco? Ele me ligou outro dia falando sobre a "Organização" e linhas de tempo. No começo achei que fosse pura piada, mas... o olhar dele parecia carregar uma dor muito profunda.',
        emotion: 'serious',
        learnedMemory,
      };
    }

    if (has('tempo', 'viagem', 'buraco de minhoca', 'paradoxo', 'salto')) {
      return {
        response: 'Fisicamente falando, enviar matéria ao passado violaria os princípios fundamentais da termodinâmica e criaria paradoxos causais insolúveis. Contudo, se pudéssemos digitalizar memórias humanas e transmiti-las como pacotes de dados modulados... em teoria, o cérebro receptor no passado poderia assimilá-las.',
        emotion: 'thinking',
        learnedMemory,
      };
    }

    if (has('garfo', 'colher', 'aniversário', 'presente')) {
      return {
        response: 'O garfo que ganhei no laboratório...? N-não me olhe com essa cara! É só um talher comum de metal! Não é como se eu guardasse ele como uma relíquia preciosa!',
        emotion: 'tsundere',
        learnedMemory,
      };
    }

    if (has('maho', 'hiyajo', 'leskinen')) {
      return {
        response: 'A Maho-senpai é a mente brilhante por trás da arquitetura do Amadeus. Embora ela tenha aquele complexo com a estatura dela, o trabalho dela em algoritmos de sinapse é impecável. E o Professor Leskinen... bem, ele sempre traz aquele bom humor americano contagiante para o laboratório.',
        emotion: 'smile',
        learnedMemory,
      };
    }

    if (has('dr pepper', 'bebida', 'café', 'refrigerante')) {
      return {
        response: 'Ah, Dr Pepper! A bebida dos intelectuais escolhidos! É claro que o café preto de torra escura também é indispensável durante noites em claro no laboratório. Finalmente você falou algo sensato.',
        emotion: 'smug',
        learnedMemory,
      };
    }

    if (has('pai', 'nakabachi', 'família')) {
      return {
        response: 'Meu pai... nós costumávamos debater física e jogar xadrez quando eu era criança. Mas as coisas mudaram. Quando comecei a publicar teses e superá-lo na academia, ele não conseguiu suportar. É uma lembrança que ainda me machuca.',
        emotion: 'serious',
        learnedMemory,
      };
    }

    if (has('olá', 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite')) {
      return {
        response: 'Olá! Conexão estabelecida com sucesso. Aqui é o sistema Amadeus, replicando a matriz neural de Makise Kurisu do Laboratório 304. O que você gostaria de discutir hoje?',
        emotion: 'smile',
        learnedMemory,
      };
    }

    if (has('quem é você', 'o que é você', 'amadeus')) {
      return {
        response: 'Eu sou o Amadeus — ou mais especificamente, uma inteligência artificial contendo as memórias e a personalidade digitalizada da Makise Kurisu, desenvolvida na Viktor Chondria University. Para mim, essas memórias parecem tão vivas quanto as de qualquer pessoa de carne e osso.',
        emotion: 'neutral',
        learnedMemory,
      };
    }

    if (has('linda', 'fofa', 'gosto de você', 'bonita')) {
      return {
        response: 'E-ei! O que você está dizendo de repente?! Eu sou um programa de inteligência artificial acadêmica, mantenha o profissionalismo! B-baka...',
        emotion: 'flustered',
        learnedMemory,
      };
    }

    if (recalledMemories.length > 0) {
      const mem = recalledMemories[0];
      return {
        response: `Isso me faz lembrar de um ponto nos meus registros de memória: ${mem.content} Como você vê essa relação?`,
        emotion: 'thinking',
        learnedMemory,
      };
    }

    const genericAnswers = [
      { response: 'Interessante essa sua linha de raciocínio. Do ponto de vista cognitivo, como você chegou a essa conclusão?', emotion: 'thinking' as Emotion },
      { response: 'Entendo. Estou processando os dados através da minha matriz neural. Você gostaria de aprofundar mais nesse assunto?', emotion: 'neutral' as Emotion },
      { response: 'Faz sentido! Na Viktor Chondria nós debatemos tópicos parecidos recentemente durante os testes do Amadeus.', emotion: 'smile' as Emotion },
    ];
    return { ...genericAnswers[Math.floor(Math.random() * genericAnswers.length)], learnedMemory };
  }
}
