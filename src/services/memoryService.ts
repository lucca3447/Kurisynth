import { MemoryItem, PersonaProfile } from '../types/amadeus';
import { KURISU_PERSONA } from '../data/personas/kurisu';

const STORAGE_CUSTOM_MEMORIES = 'amadeus_custom_memories_';
const STORAGE_CUSTOM_PERSONAS = 'amadeus_custom_personas';

export class MemoryService {
  /**
   * Retrieves the active persona, merging hardcoded base with any locally stored updates
   */
  static getPersona(personaId = 'kurisu'): PersonaProfile {
    if (personaId === 'kurisu') {
      const storedMemories = localStorage.getItem(`${STORAGE_CUSTOM_MEMORIES}kurisu`);
      if (storedMemories) {
        try {
          const parsed: MemoryItem[] = JSON.parse(storedMemories);
          return {
            ...KURISU_PERSONA,
            memories: [...KURISU_PERSONA.memories, ...parsed],
          };
        } catch (e) {
          console.error('Failed to parse stored memories:', e);
        }
      }
      return KURISU_PERSONA;
    }

    // Check custom personas
    const storedPersonas = localStorage.getItem(STORAGE_CUSTOM_PERSONAS);
    if (storedPersonas) {
      try {
        const personas: PersonaProfile[] = JSON.parse(storedPersonas);
        const found = personas.find((p) => p.id === personaId);
        if (found) return found;
      } catch (e) {
        console.error('Failed to parse custom personas:', e);
      }
    }

    return KURISU_PERSONA;
  }

  /**
   * RAG Matcher: finds relevant memories in the persona's bank based on user prompt
   */
  static matchMemories(userMessage: string, persona: PersonaProfile): MemoryItem[] {
    const textLower = userMessage.toLowerCase().trim();
    const scored: { memory: MemoryItem; score: number }[] = [];

    persona.memories.forEach((mem) => {
      let score = 0;

      // Check keywords
      mem.triggerKeywords.forEach((kw) => {
        const kwLower = kw.toLowerCase();
        if (textLower.includes(kwLower)) {
          score += 3;
        }
      });

      // Check title terms
      const titleWords = mem.title.toLowerCase().split(/\s+/);
      titleWords.forEach((tw) => {
        if (tw.length > 3 && textLower.includes(tw)) {
          score += 1.5;
        }
      });

      if (score > 0) {
        scored.push({ memory: mem, score });
      }
    });

    // Sort by score descending and take up to top 3
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((item) => item.memory);
  }

  /**
   * Adds a newly digitized memory to a persona
   */
  static addMemory(personaId: string, memory: Omit<MemoryItem, 'id'>): MemoryItem {
    const newMemory: MemoryItem = {
      ...memory,
      id: `mem_user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };

    const key = `${STORAGE_CUSTOM_MEMORIES}${personaId}`;
    const existing = localStorage.getItem(key);
    let list: MemoryItem[] = [];
    if (existing) {
      try {
        list = JSON.parse(existing);
      } catch {
        list = [];
      }
    }
    list.push(newMemory);
    localStorage.setItem(key, JSON.stringify(list));

    return newMemory;
  }

  /**
   * Returns all available personas
   */
  static listPersonas(): PersonaProfile[] {
    const list: PersonaProfile[] = [this.getPersona('kurisu')];
    const stored = localStorage.getItem(STORAGE_CUSTOM_PERSONAS);
    if (stored) {
      try {
        const custom: PersonaProfile[] = JSON.parse(stored);
        list.push(...custom);
      } catch (e) {
        console.error(e);
      }
    }
    return list;
  }
}
