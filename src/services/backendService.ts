import { ChatMessage, Emotion, MemoryItem, CallSession } from '../types/amadeus';

const BACKEND_URL = 'http://localhost:8000';

export interface BackendHealth {
  status: string;
  system: string;
  database: string;
  vectorStore: string;
  chromaCount: number;
  totalMemories: number;
  totalSessions: number;
  edgeTtsAvailable: boolean;
}

export interface BackendChatResponse {
  response: string;
  emotion: Emotion;
  recalledMemories: string[];
  sessionId?: string;
  model?: string;
  learnedMemory?: {
    title: string;
    content: string;
    emotionalWeight?: string;
  };
  error?: string;
}

export class BackendService {
  private static isAvailable: boolean | null = null;
  private static lastCheckTime = 0;
  private static CHECK_INTERVAL_MS = 15000; // Check health every 15s

  /**
   * Probes if the local FastAPI Python backend (SQLite + ChromaDB) is running
   */
  static async checkHealth(): Promise<BackendHealth | null> {
    const now = Date.now();
    if (this.isAvailable !== null && now - this.lastCheckTime < this.CHECK_INTERVAL_MS) {
      if (!this.isAvailable) return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${BACKEND_URL}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.isAvailable = true;
        this.lastCheckTime = now;
        return data as BackendHealth;
      }
    } catch {
      // Backend not running
    }

    this.isAvailable = false;
    this.lastCheckTime = now;
    return null;
  }

  static getIsAvailableCached(): boolean {
    return this.isAvailable === true;
  }

  /**
   * Queries Amadeus via the Python backend (with ChromaDB semantic retrieval & SQLite persistence)
   */
  static async queryChat(
    message: string,
    sessionId: string | null,
    apiKey: string,
    history: ChatMessage[]
  ): Promise<BackendChatResponse> {
    const formattedHistory = history.slice(-20).map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      content: msg.content,
    }));

    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId,
        personaId: 'kurisu',
        apiKey: apiKey || null,
        history: formattedHistory,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Erro no servidor Python');
      throw new Error(`[Backend ${res.status}] ${errorText}`);
    }

    return (await res.json()) as BackendChatResponse;
  }

  /**
   * Retrieves all memories from ChromaDB + SQLite
   */
  static async getMemories(): Promise<MemoryItem[]> {
    const res = await fetch(`${BACKEND_URL}/api/memories`);
    if (!res.ok) throw new Error('Falha ao buscar memórias do servidor');
    return res.json();
  }

  /**
   * Adds a new memory to ChromaDB + SQLite
   */
  static async addMemory(memory: {
    category: string;
    title: string;
    content: string;
    emotionalWeight?: string;
    source?: string;
  }): Promise<MemoryItem> {
    const res = await fetch(`${BACKEND_URL}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory),
    });
    if (!res.ok) throw new Error('Falha ao adicionar memória no servidor');
    return res.json();
  }

  /**
   * Deletes a memory from ChromaDB + SQLite
   */
  static async deleteMemory(memoryId: string): Promise<boolean> {
    const res = await fetch(`${BACKEND_URL}/api/memories/${encodeURIComponent(memoryId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  }

  /**
   * Lists all sessions from SQLite
   */
  static async listSessions(): Promise<CallSession[]> {
    const res = await fetch(`${BACKEND_URL}/api/sessions`);
    if (!res.ok) return [];
    return res.json();
  }

  /**
   * Creates a new session in SQLite
   */
  static async createSession(): Promise<string> {
    const res = await fetch(`${BACKEND_URL}/api/sessions/new`, { method: 'POST' });
    if (!res.ok) throw new Error('Falha ao criar sessão');
    const data = await res.json();
    return data.sessionId;
  }

  /**
   * Retrieves messages for a specific session from SQLite
   */
  static async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const res = await fetch(`${BACKEND_URL}/api/sessions/${encodeURIComponent(sessionId)}/messages`);
    if (!res.ok) return [];
    return res.json();
  }
}
