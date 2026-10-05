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
  | 'flustered'
  | 'sad'
  | 'puzzled'
  | 'desperate';

export type MemorySource = 'canonical' | 'learned' | 'custom';

export interface MemoryItem {
  id: string;
  category: 'biography' | 'research' | 'relationship' | 'secret' | 'anecdote' | 'user';
  title: string;
  triggerKeywords: string[];
  content: string;
  emotionalWeight?: string;
  source?: MemorySource;
  createdAt?: number;
  distance?: number;
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

export interface CallSession {
  id: string;
  startedAt: number;
  endedAt?: number;
  summary?: string;
  messageCount?: number;
  messages?: ChatMessage[];
}

export interface VoiceSettings {
  enabled: boolean;
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
  autoSpeak: boolean;
  lang: string;
  useNeural?: boolean;
  neuralVoice?: string;
}

export interface SystemConfig {
  geminiApiKey: string;
  model: string;
  scanlinesEnabled: boolean;
  activePersonaId: string;
  useBackend: boolean;
}
