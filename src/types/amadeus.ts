export type Emotion = 
  | 'neutral'
  | 'smile'
  | 'happy'
  | 'serious'
  | 'annoyed'
  | 'surprised'
  | 'tsundere'
  | 'thinking'
  | 'smug'
  | 'flustered';

export interface MemoryItem {
  id: string;
  category: 'biography' | 'research' | 'relationship' | 'secret' | 'anecdote';
  title: string;
  triggerKeywords: string[];
  content: string;
  emotionalWeight?: string;
}

export interface PersonaProfile {
  id: string;
  name: string;
  codeName: string;
  title: string;
  description: string;
  affiliation: string;
  avatarPrefix: string;
  systemPrompt: string;
  memories: MemoryItem[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'amadeus' | 'system';
  content: string;
  timestamp: number;
  emotion?: Emotion;
  recalledMemories?: string[];
}

export interface VoiceSettings {
  enabled: boolean;
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
  autoSpeak: boolean;
  lang: string;
}

export interface SystemConfig {
  geminiApiKey: string;
  model: string;
  scanlinesEnabled: boolean;
  activePersonaId: string;
}
