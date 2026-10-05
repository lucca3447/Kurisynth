export type SpeechCallback = (text: string) => void;
export type SpeechStateCallback = (isListening: boolean) => void;

// TypeScript declaration for webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export class SpeechService {
  private static recognition: any = null;
  private static isListening = false;

  /**
   * Initializes Speech Recognition (STT - Microphone)
   */
  static initRecognition(
    onResult: SpeechCallback,
    onStateChange: SpeechStateCallback
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
        console.warn('Speech recognition error:', event.error);
        this.isListening = false;
        onStateChange(false);
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
    } else {
      try {
        this.recognition.start();
        return true;
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
        return false;
      }
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
   * Speaks text using the browser's native Text-to-Speech
   */
  static speak(
    text: string,
    options: {
      voiceURI?: string | null;
      rate?: number;
      pitch?: number;
      volume?: number;
      lang?: string;
      onStart?: () => void;
      onEnd?: () => void;
    } = {}
  ): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean text: strip emotion tags and Markdown formatting
    const cleanText = text
      .replace(/<!--emotion:[a-z]+-->/gi, '')
      .replace(/\*+/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = options.rate ?? 1.05;
    utterance.pitch = options.pitch ?? 1.15; // slightly higher pitch for anime persona
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
      options.onStart?.();
    };

    utterance.onend = () => {
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      options.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Stops any ongoing speech synthesis
   */
  static stopSpeaking(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
