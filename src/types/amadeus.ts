export type CanonicalEmotion = 
  | 'neutral'
  | 'wink'
  | 'annoyed'
  | 'worried'
  | 'disdain'
  | 'happy'
  | 'stern'
  | 'blushing'
  | 'look_side'
  | 'eyes_closed'
  | 'analytical'
  | 'holding_back_tears';

export type LegacyEmotion = 
  | 'smile'
  | 'serious'
  | 'surprised'
  | 'tsundere'
  | 'thinking'
  | 'smug'
  | 'flustered'
  | 'sad'
  | 'puzzled'
  | 'desperate';

export type Emotion = CanonicalEmotion | LegacyEmotion;

export type CharacterPose = 'default' | 'crossed_arms' | 'backview';

export type MouthState = 'closed' | 'half' | 'open';

export interface SpriteExpressionFrames {
  mouthClosed: string; // 00: mouth closed / idle
  mouthHalf: string;   // 01: mouth half-open / transition
  mouthOpen: string;   // 02: mouth fully open / apex
  blinkFrame?: string; // Matching closed-eyes frame (slot 'a')
}

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
  pose?: CharacterPose;
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
  useRvc?: boolean;
  rvcPitch?: number;
  rvcIndexRate?: number;
}

export interface SystemConfig {
  geminiApiKey: string;
  model: string;
  scanlinesEnabled: boolean;
  activePersonaId: string;
  useBackend: boolean;
}
