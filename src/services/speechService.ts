import { BackendService } from './backendService';

export type SpeechCallback = (text: string) => void;
export type SpeechStateCallback = (isListening: boolean) => void;
export type LipSyncCallback = (isOpen: boolean, amplitude: number) => void;

// TypeScript declaration for webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export interface SpeakOptions {
  voiceURI?: string | null;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  useNeural?: boolean;
  neuralVoice?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Normalizes text for natural-sounding speech synthesis in Portuguese:
 * - Inserts natural breathing pauses into stutters (tsundere persona)
 * - Transcribes acronyms and Steins;Gate lore terms into fluent phonetic Portuguese
 * - Removes markdown formatting and internal tags
 */
export function normalizeForSpeech(rawText: string): string {
  let text = rawText || '';

  // 1. Remove emotion and memory tags
  text = text.replace(/<!--\s*(?:emotion|remember):.*?\s*-->/gi, '');

  // 2. Remove markdown code blocks, bold, italic, quotes
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`.*?`/g, '');
  text = text.replace(/[*_~#]/g, '');
  text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');

  // 3. Stutter / hesitation normalization for anime persona:
  // "N-não" -> "N... não", "Q-quem" -> "Q... quem", "E-eu" -> "E... eu", "D-do que" -> "D... do que"
  text = text.replace(/\b([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ])-([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+)\b/g, '$1... $2');

  // 4. Steins;Gate Lore & Tech Acronym Pronunciations
  text = text.replace(/\bSERN\b/g, 'Sérn');
  text = text.replace(/\bLHC\b/g, 'éle agá cê');
  text = text.replace(/@channel\b/gi, 'at channel');
  text = text.replace(/\bchanneler\b/gi, 'channeler');
  text = text.replace(/\bIBN\s*5100\b/gi, 'I B N cinco mil e cem');
  text = text.replace(/\bDr\b\.?\s*Pepper\b/gi, 'Doutor Pepper');
  text = text.replace(/\bSteins;Gate\b/gi, 'Steins Gate');
  text = text.replace(/\bViktor\s*Chondria\b/gi, 'Víktor Chôndria');
  text = text.replace(/\bNullpo\b/gi, 'Núlpo');
  text = text.replace(/\bNurupo\b/gi, 'Nurúpo');
  text = text.replace(/\bKurigohan\b/gi, 'Kúrigohan');
  text = text.replace(/\bKamehameha\b/gi, 'Kamehamêha');
  text = text.replace(/\bHououin\s*Kyouma\b/gi, 'Houôin Kyouma');
  text = text.replace(/\bLabMem\b/gi, 'Lab Mem');
  text = text.replace(/\bReading\s*Steiner\b/gi, 'Ríding Stáiner');

  // 5. Clean up multiple punctuation and whitespace
  text = text.replace(/\.{4,}/g, '...');
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

export class SpeechService {
  private static recognition: any = null;
  private static isListening = false;

  // Web Audio API singletons for lip-sync and oscilloscope
  private static audioCtx: AudioContext | null = null;
  private static analyser: AnalyserNode | null = null;
  private static neuralAudio: HTMLAudioElement | null = null;
  private static audioSourceConnected = false;
  private static isSpeakingAudio = false;

  // Listeners for acoustic amplitude and lip flap
  private static lipSyncListeners: Set<LipSyncCallback> = new Set();
  private static lipSyncAnimFrame: number | null = null;
  private static simulatedLipSyncTimeout: number | null = null;

  static isRecognitionSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Initializes Speech Recognition (STT - Microphone)
   */
  static initRecognition(
    onResult: SpeechCallback,
    onStateChange: SpeechStateCallback,
    onError?: (message: string) => void
  ): boolean {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('Web Speech API (SpeechRecognition) is not supported in this browser.');
      return false;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'pt-BR';

      this.recognition.onstart = () => {
        this.isListening = true;
        onStateChange(true);
      };

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onResult(transcript);
        }
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        onStateChange(false);

        // Silence or user cancel are not real failures
        if (event.error === 'no-speech' || event.error === 'aborted') return;

        console.warn('Speech recognition error:', event.error);
        const messages: Record<string, string> = {
          'not-allowed': 'Microfone bloqueado. Clique no cadeado ao lado do endereço (localhost:5173), permita o Microfone e recarregue a página.',
          'service-not-allowed': 'O navegador não permite reconhecimento de voz aqui. Use Chrome ou Edge.',
          'audio-capture': 'Nenhum microfone encontrado. Verifique se ele está conectado.',
          'network': 'O reconhecimento de voz precisa de internet (o navegador usa um serviço online).',
        };
        onError?.(messages[event.error] ?? `Erro no microfone: ${event.error}`);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        onStateChange(false);
      };

      return true;
    } catch (e) {
      console.error('Error initializing speech recognition:', e);
      return false;
    }
  }

  /**
   * Toggles listening on/off
   */
  static toggleListening(): boolean {
    if (!this.recognition) return false;

    if (this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error(e);
      }
      this.isListening = false;
      return false;
    }

    try {
      this.recognition.start();
      return true;
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      return false;
    }
  }

  /**
   * Returns list of available browser synthesis voices
   */
  static getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve([]);
        return;
      }

      let voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }

      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        resolve(voices);
      };
    });
  }

  /**
   * Ensures Web Audio API context and analyser node are active
   */
  private static ensureAudioContext(): { ctx: AudioContext; analyser: AnalyserNode } {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.65;
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return { ctx: this.audioCtx, analyser: this.analyser! };
  }

  /**
   * Returns the global AnalyserNode for audio visualization (oscilloscope)
   */
  static getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Registers a subscriber for real-time lip-sync events (mouth open / close + amplitude)
   */
  static addLipSyncListener(cb: LipSyncCallback): () => void {
    this.lipSyncListeners.add(cb);
    return () => {
      this.lipSyncListeners.delete(cb);
    };
  }

  private static notifyLipSync(isOpen: boolean, amplitude: number): void {
    this.lipSyncListeners.forEach((cb) => {
      try {
        cb(isOpen, amplitude);
      } catch {}
    });
  }

  /**
   * Monitors real acoustic audio amplitude via FFT and drives lip-sync mouth frames
   */
  private static startLipSyncMonitoring(): void {
    if (this.lipSyncAnimFrame) return;

    const dataArray = new Uint8Array(this.analyser?.frequencyBinCount || 128);

    const checkFrame = () => {
      if (!this.isSpeakingAudio) {
        this.notifyLipSync(false, 0);
        this.lipSyncAnimFrame = null;
        return;
      }

      if (this.analyser) {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        // Check vocal frequency bins (approx 300Hz - 3500Hz)
        const maxBins = Math.min(dataArray.length, 64);
        for (let i = 2; i < maxBins; i++) {
          sum += dataArray[i];
        }
        const avg = sum / (maxBins - 2);
        const normalized = Math.min(1.0, avg / 85.0);
        const isOpen = normalized > 0.16;
        this.notifyLipSync(isOpen, normalized);
      }

      this.lipSyncAnimFrame = requestAnimationFrame(checkFrame);
    };

    this.lipSyncAnimFrame = requestAnimationFrame(checkFrame);
  }

  /**
   * Main speech function:
   * 1. Tries neural Edge-TTS (FranciscaNeural / ThalitaNeural) via Python backend
   * 2. Falls back seamlessly to browser SpeechSynthesisUtterance if backend offline
   */
  static async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    const cleanText = normalizeForSpeech(text);
    if (!cleanText) return;

    this.stopSpeaking();

    // Check if neural TTS should be used (default true if backend online and edge-tts available)
    const health = await BackendService.checkHealth().catch(() => null);
    const useNeural = options.useNeural !== false && Boolean(health && health.edgeTtsAvailable !== false);

    if (useNeural) {
      try {
        await this.speakNeural(cleanText, options);
        return;
      } catch (err) {
        console.warn('[SpeechService] Neural Edge-TTS playback failed, falling back to Web Speech:', err);
      }
    }

    // Fallback to browser Web Speech API
    this.speakWebSpeech(cleanText, options);
  }

  /**
   * Streams and plays Microsoft Edge-TTS neural speech through Web Audio API
   */
  private static async speakNeural(cleanText: string, options: SpeakOptions): Promise<void> {
    const { ctx, analyser } = this.ensureAudioContext();

    const voice = options.neuralVoice || 'pt-BR-FranciscaNeural';
    const rate = options.rate ? `${Math.round((options.rate - 1) * 100)}%` : '+4%';
    const pitch = options.pitch ? `${Math.round((options.pitch - 1) * 20)}Hz` : '+10Hz';

    const res = await fetch('http://localhost:8000/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanText,
        voice,
        rate: rate.startsWith('-') || rate.startsWith('+') ? rate : `+${rate}`,
        pitch: pitch.startsWith('-') || pitch.startsWith('+') ? pitch : `+${pitch}`,
      }),
    });

    if (!res.ok) {
      throw new Error(`Edge-TTS endpoint returned ${res.status}`);
    }

    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);

    if (!this.neuralAudio) {
      this.neuralAudio = new Audio();
      this.neuralAudio.crossOrigin = 'anonymous';
    }

    const audio = this.neuralAudio;
    audio.src = audioUrl;
    audio.volume = options.volume ?? 1.0;

    if (!this.audioSourceConnected) {
      try {
        const sourceNode = ctx.createMediaElementSource(audio);
        sourceNode.connect(analyser);
        analyser.connect(ctx.destination);
        this.audioSourceConnected = true;
      } catch (e) {
        console.warn('[SpeechService] Audio source connection note:', e);
      }
    }

    return new Promise((resolve, reject) => {
      audio.onplay = () => {
        this.isSpeakingAudio = true;
        this.startLipSyncMonitoring();
        options.onStart?.();
      };

      audio.onended = () => {
        this.isSpeakingAudio = false;
        this.notifyLipSync(false, 0);
        URL.revokeObjectURL(audioUrl);
        options.onEnd?.();
        resolve();
      };

      audio.onerror = (e) => {
        this.isSpeakingAudio = false;
        this.notifyLipSync(false, 0);
        URL.revokeObjectURL(audioUrl);
        options.onEnd?.();
        reject(e);
      };

      audio.play().catch(reject);
    });
  }

  /**
   * Browser-native SpeechSynthesisUtterance with word-boundary syllable lip-sync
   */
  private static speakWebSpeech(cleanText: string, options: SpeakOptions): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = options.rate ?? 1.05;
    utterance.pitch = options.pitch ?? 1.15;
    utterance.volume = options.volume ?? 1.0;
    utterance.lang = options.lang ?? 'pt-BR';

    if (options.voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const selected = voices.find((v) => v.voiceURI === options.voiceURI);
      if (selected) {
        utterance.voice = selected;
      }
    }

    utterance.onstart = () => {
      this.isSpeakingAudio = true;
      options.onStart?.();
    };

    // Word boundary event for syllable-accurate mouth movements
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        this.notifyLipSync(true, 0.7);
        if (this.simulatedLipSyncTimeout) clearTimeout(this.simulatedLipSyncTimeout);
        this.simulatedLipSyncTimeout = window.setTimeout(() => {
          this.notifyLipSync(false, 0);
        }, 125);
      }
    };

    utterance.onend = () => {
      this.isSpeakingAudio = false;
      this.notifyLipSync(false, 0);
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isSpeakingAudio = false;
      this.notifyLipSync(false, 0);
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('Speech synthesis error:', e.error);
      }
      options.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Stops any ongoing speech synthesis (neural or browser)
   */
  static stopSpeaking(): void {
    this.isSpeakingAudio = false;
    this.notifyLipSync(false, 0);

    if (this.simulatedLipSyncTimeout) {
      clearTimeout(this.simulatedLipSyncTimeout);
      this.simulatedLipSyncTimeout = null;
    }

    if (this.neuralAudio) {
      try {
        this.neuralAudio.pause();
        this.neuralAudio.currentTime = 0;
      } catch {}
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
