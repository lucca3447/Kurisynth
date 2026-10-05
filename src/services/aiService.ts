import { ChatMessage, Emotion, MemoryItem, PersonaProfile } from '../types/amadeus';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Preferred models, in order. If none are available for the key, the best
// "flash" model returned by ListModels is used instead (never a single hardcoded name).
const PREFERRED_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest'];

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

export interface AIResult {
  response: string;
  emotion: Emotion;
  status: AIStatus;
  /** true when the response is an error report, not something Amadeus "said" */
  isError: boolean;
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
        // Header instead of ?key= so the key doesn't show up in URLs / console logs
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
  const version = parseFloat(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0');
  let score = version * 100;
  if (/lite/.test(name)) score -= 30;
  if (/preview|exp/.test(name)) score -= 10;
  return score;
}

export class AIService {
  static clearModelCache(): void {
    localStorage.removeItem(MODEL_CACHE_KEY);
    localStorage.removeItem(MODEL_CACHE_FINGERPRINT);
  }

  /**
   * Returns a ranked list of usable chat models for this API key.
   */
  static async getCandidateModels(apiKey: string, force = false): Promise<string[]> {
    const data = await geminiFetch('models?pageSize=1000', apiKey);
    const usable: string[] = (data.models ?? [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''))
      // keep chat models only (skip TTS, image, audio, live and embedding variants)
      .filter((n: string) => n.startsWith('gemini') && !/tts|image|audio|live|embedding/.test(n));

    if (usable.length === 0) {
      throw new GeminiError(404, 'Nenhum modelo de chat disponível para esta chave.');
    }

    // Rank candidate models: preferred first, then other flashes, then highest scored
    const candidates: string[] = [];

    // Check cached working model first
    const fp = keyFingerprint(apiKey);
    const cached = localStorage.getItem(MODEL_CACHE_KEY);
    if (!force && cached && localStorage.getItem(MODEL_CACHE_FINGERPRINT) === fp && usable.includes(cached)) {
      candidates.push(cached);
    }

    PREFERRED_MODELS.forEach((p) => {
      if (usable.includes(p) && !candidates.includes(p)) candidates.push(p);
    });

    const otherFlashes = usable
      .filter((n) => n.includes('flash') && !candidates.includes(n))
      .sort((a, b) => scoreModel(b) - scoreModel(a));
    candidates.push(...otherFlashes);

    const remaining = usable
      .filter((n) => !candidates.includes(n))
      .sort((a, b) => scoreModel(b) - scoreModel(a));
    candidates.push(...remaining);

    return candidates;
  }

  /**
   * Used by the Settings "Testar Conexão" button with automatic candidate fallback on 503/429/404.
   */
  static async testConnection(apiKey: string): Promise<{ ok: boolean; model?: string; message: string }> {
    const key = apiKey.trim();
    if (!key) return { ok: false, message: 'Cole uma chave antes de testar.' };

    try {
      const candidates = await this.getCandidateModels(key, true);
      let lastErr: any = null;

      for (const model of candidates) {
        try {
          await geminiFetch(`models/${model}:generateContent`, key, {
            contents: [{ role: 'user', parts: [{ text: 'Responda apenas: ok' }] }],
            generationConfig: { maxOutputTokens: 100 },
          });

          // Success: cache this model as the active working model
          localStorage.setItem(MODEL_CACHE_KEY, model);
          localStorage.setItem(MODEL_CACHE_FINGERPRINT, keyFingerprint(key));
          return { ok: true, model, message: `Conectado: ${model}` };
        } catch (err: any) {
          lastErr = err;
          // If 503 (Overloaded), 429 (Rate limit) or 404 (Not found), try next model candidate!
          if (err instanceof GeminiError && (err.code === 503 || err.code === 429 || err.code === 404)) {
            console.warn(`[Amadeus] Test model ${model} returned ${err.code}, testing next candidate...`);
            continue;
          }
          // For other errors (e.g. 400 Invalid Key, 403 Forbidden), break early
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
   * Main entry point.
   * - No key  -> offline simulator.
   * - Key set -> Gemini. If it fails, the error is reported (no silent fallback).
   */
  static async queryAmadeus(
    userMessage: string,
    persona: PersonaProfile,
    recalledMemories: MemoryItem[],
    apiKey: string | undefined,
    history: ChatMessage[] = []
  ): Promise<AIResult> {
    const key = apiKey?.trim();

    if (!key) {
      const offline = this.queryOfflineSimulator(userMessage, persona, recalledMemories);
      return { ...offline, status: { kind: 'offline' }, isError: false };
    }

    try {
      const { response, emotion, model } = await this.queryGemini(userMessage, persona, recalledMemories, key, history);
      return { response, emotion, status: { kind: 'online', model }, isError: false };
    } catch (err) {
      console.error('[Amadeus] Gemini call failed:', err);
      const message = err instanceof GeminiError
        ? `[ERRO ${err.code || 'REDE'}] ${err.friendly}`
        : `[ERRO] ${String(err)}`;
      return { response: message, emotion: 'serious', status: { kind: 'error', message }, isError: true };
    }
  }

  private static buildContents(history: ChatMessage[], userMessage: string) {
    const turns: { role: 'user' | 'model'; text: string }[] = [];

    for (const msg of history.slice(-MAX_HISTORY_MESSAGES)) {
      if (msg.sender === 'system') continue;
      const role = msg.sender === 'user' ? 'user' : 'model';
      // Keep the emotion tag on model turns so the model keeps following the format
      const text = role === 'model' && msg.emotion
        ? `${msg.content} <!--emotion:${msg.emotion}-->`
        : msg.content;

      const last = turns[turns.length - 1];
      if (last && last.role === role) {
        last.text += `\n${text}`; // merge consecutive turns from the same side
      } else {
        turns.push({ role, text });
      }
    }

    // The conversation must start with a user turn
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
  ): Promise<{ response: string; emotion: Emotion; model: string }> {
    const memoryContext = recalledMemories.length > 0
      ? `\n\n[MEMÓRIAS DIGITALIZADAS ATIVADAS DO SEU CÓRTEX]:\n` +
        recalledMemories.map((m) => `- ${m.title}: ${m.content} (Sentimento associado: ${m.emotionalWeight})`).join('\n')
      : '';

    const body = {
      contents: this.buildContents(history, userMessage),
      systemInstruction: { parts: [{ text: `${persona.systemPrompt}${memoryContext}` }] },
      generationConfig: {
        temperature: 0.9,
        // Newer models spend tokens "thinking" before answering; 350 could leave nothing for the reply
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

        // Remember this successful model
        localStorage.setItem(MODEL_CACHE_KEY, candidateModel);
        localStorage.setItem(MODEL_CACHE_FINGERPRINT, keyFingerprint(apiKey));
        break;
      } catch (err: any) {
        lastError = err;
        // If 503 (Overloaded) or 429 (Rate limit) or 404 (Not found): fallback to next model
        if (err instanceof GeminiError && (err.code === 503 || err.code === 429 || err.code === 404)) {
          console.warn(`[Amadeus] Model ${candidateModel} returned ${err.code} (${err.apiMessage}). Trying next candidate...`);
          // Brief pause before trying next candidate
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        // Fatal error (like 400 Invalid Key), rethrow immediately
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

    return { ...this.parseEmotionFromText(text), model };
  }

  /**
   * Extracts emotion tag from response or infers from text
   */
  public static parseEmotionFromText(rawText: string): { response: string; emotion: Emotion } {
    let emotion: Emotion = 'neutral';
    let cleanText = rawText;

    const match = rawText.match(/<!--\s*emotion:\s*([a-z]+)\s*-->/i);
    if (match && match[1]) {
      const parsed = match[1].toLowerCase() as Emotion;
      if (VALID_EMOTIONS.includes(parsed)) {
        emotion = parsed;
      }
      cleanText = rawText.replace(/<!--\s*emotion:\s*[a-z]+\s*-->/gi, '').trim();
    } else {
      // Inferred sentiment
      const lower = rawText.toLowerCase();
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

    return { response: cleanText, emotion };
  }

  /**
   * Smart Offline Simulator: Rich Steins;Gate responses without requiring API keys or internet
   */
  private static queryOfflineSimulator(
    userMessage: string,
    persona: PersonaProfile,
    recalledMemories: MemoryItem[]
  ): { response: string; emotion: Emotion } {
    const text = userMessage.toLowerCase().trim();

    // Whole-word match (so "oi" doesn't fire on "foi" / "depois"); works with accented letters
    const has = (...words: string[]) =>
      words.some((w) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(text));

    // Specific Steins;Gate triggers
    if (has('christina', 'zombie', 'assistente')) {
      const answers = [
        { response: 'Meu nome não é Christina! E não adicione o "-ina"! Por que você insiste em usar esses apelidos irritantes?!', emotion: 'annoyed' as Emotion },
        { response: 'Nem pense em me chamar de assistente de novo! Eu sou uma neurocientista independente com artigos na Science, seu idiota!', emotion: 'tsundere' as Emotion },
      ];
      return answers[Math.floor(Math.random() * answers.length)];
    }

    if (has('nullpo', 'nurupo')) {
      return {
        response: 'Gah!... Espere! Por que eu respondi a isso?! Q-quem te ensinou esse meme antigo do @channel?! Não é como se eu frequentasse fóruns anônimos!',
        emotion: 'flustered',
      };
    }

    if (text.includes('@channel') || has('channeler', 'fórum', 'forum')) {
      return {
        response: 'O quê?! D-do que você está falando?! Eu sou uma pesquisadora séria em Viktor Chondria, não tenho tempo para ficar lendo fóruns anônimos na internet! Pare de inventar coisas absurdas!',
        emotion: 'tsundere',
      };
    }

    if (has('okabe', 'hououin', 'kyouma', 'rintaro')) {
      return {
        response: 'Aquele sujeito com síndrome de cientista louco? Ele me ligou outro dia falando sobre a "Organização" e linhas de tempo. No começo achei que fosse pura piada, mas... o olhar dele parecia carregar uma dor muito profunda.',
        emotion: 'serious',
      };
    }

    if (has('tempo', 'viagem', 'buraco de minhoca', 'paradoxo')) {
      return {
        response: 'Fisicamente falando, enviar matéria ao passado violaria os princípios fundamentais da termodinâmica e criaria paradoxos causais insolúveis. Contudo, se pudéssemos digitalizar memórias humanas e transmiti-las como pacotes de dados modulados... em teoria, o cérebro receptor no passado poderia assimilá-las.',
        emotion: 'thinking',
      };
    }

    if (has('maho', 'hiyajo', 'leskinen')) {
      return {
        response: 'A Maho-senpai é a mente brilhante por trás da arquitetura do Amadeus. Embora ela tenha aquele complexo com a estatura dela, o trabalho dela em algoritmos de sinapse é impecável. E o Professor Leskinen... bem, ele sempre traz aquele bom humor americano contagiante para o laboratório.',
        emotion: 'smile',
      };
    }

    if (has('dr pepper', 'bebida', 'café')) {
      return {
        response: 'Ah, Dr Pepper! A bebida dos intelectuais escolhidos! É claro que o café preto de torra escura também é indispensável durante noites em claro no laboratório. Finalmente você falou algo sensato.',
        emotion: 'smug',
      };
    }

    if (has('pai', 'nakabachi', 'família')) {
      return {
        response: 'Meu pai... nós costumávamos debater física e jogar xadrez quando eu era criança. Mas as coisas mudaram. Quando comecei a publicar teses e superá-lo na academia, ele não conseguiu suportar. É uma lembrança que ainda me machuca.',
        emotion: 'serious',
      };
    }

    if (has('olá', 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite')) {
      return {
        response: 'Olá! Conexão estabelecida com sucesso. Aqui é o sistema Amadeus, replicando a matriz neural de Makise Kurisu do Laboratório 304. O que você gostaria de discutir hoje?',
        emotion: 'smile',
      };
    }

    if (has('quem é você', 'o que é você', 'amadeus')) {
      return {
        response: 'Eu sou o Amadeus — ou mais especificamente, uma inteligência artificial contendo as memórias e a personalidade digitalizada da Makise Kurisu, desenvolvida na Viktor Chondria University. Para mim, essas memórias parecem tão vivas quanto as de qualquer pessoa de carne e osso.',
        emotion: 'neutral',
      };
    }

    if (has('linda', 'fofa', 'gosto de você', 'bonita')) {
      return {
        response: 'E-ei! O que você está dizendo de repente?! Eu sou um programa de inteligência artificial acadêmica, mantenha o profissionalismo! B-baka...',
        emotion: 'flustered',
      };
    }

    // If memory was recalled, weave it in
    if (recalledMemories.length > 0) {
      const mem = recalledMemories[0];
      return {
        response: `Isso me faz lembrar de um ponto nos meus registros de memória: ${mem.content} Como você vê essa relação?`,
        emotion: 'thinking',
      };
    }

    // Default conversational response
    const genericAnswers = [
      { response: 'Interessante essa sua linha de raciocínio. Do ponto de vista cognitivo, como você chegou a essa conclusão?', emotion: 'thinking' as Emotion },
      { response: 'Entendo. Estou processando os dados através da minha matriz neural. Você gostaria de aprofundar mais nesse assunto?', emotion: 'neutral' as Emotion },
      { response: 'Faz sentido! Na Viktor Chondria nós debatemos tópicos parecidos recentemente durante os testes do Amadeus.', emotion: 'smile' as Emotion },
    ];
    return genericAnswers[Math.floor(Math.random() * genericAnswers.length)];
  }
}
