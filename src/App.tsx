import React, { useState, useEffect, useRef } from 'react';
import { Emotion, MemoryItem, PersonaProfile, VoiceSettings } from './types/amadeus';
import { MemoryService } from './services/memoryService';
import { AIService } from './services/aiService';
import { SpeechService } from './services/speechService';
import { CallHeader } from './components/CallHeader';
import { AmadeusSpriteView } from './components/AmadeusSpriteView';
import { AudioOscilloscope } from './components/AudioOscilloscope';
import { SubtitleBox } from './components/SubtitleBox';
import { ControlBar } from './components/ControlBar';
import { MemoryInspectorModal } from './components/MemoryInspectorModal';
import { SettingsModal } from './components/SettingsModal';
import { IncomingCallScreen } from './components/IncomingCallScreen';
import { Phone, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  // Call state: 'incoming' | 'connected' | 'disconnected'
  const [callState, setCallState] = useState<'incoming' | 'connected' | 'disconnected'>('incoming');
  
  // Persona and cognitive state
  const [persona, setPersona] = useState<PersonaProfile>(() => MemoryService.getPersona('kurisu'));
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  const [recalledMemoryIds, setRecalledMemoryIds] = useState<string[]>([]);
  
  // Dialogue and speech state
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);

  // Configuration and persistence
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('amadeus_gemini_key') || '');
  const [scanlines, setScanlines] = useState<boolean>(() => {
    const val = localStorage.getItem('amadeus_scanlines');
    return val !== null ? val === 'true' : true;
  });
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    const val = localStorage.getItem('amadeus_voice_settings');
    if (val) {
      try {
        return JSON.parse(val);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      enabled: true,
      voiceURI: null,
      rate: 1.05,
      pitch: 1.15,
      volume: 1.0,
      autoSpeak: true,
      lang: 'pt-BR',
    };
  });

  // Modal states
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Save settings
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('amadeus_gemini_key', key);
  };

  const handleSaveVoiceSettings = (settings: VoiceSettings) => {
    setVoiceSettings(settings);
    localStorage.setItem('amadeus_voice_settings', JSON.stringify(settings));
  };

  const handleToggleScanlines = (enabled: boolean) => {
    setScanlines(enabled);
    localStorage.setItem('amadeus_scanlines', String(enabled));
  };

  // Initialize Speech Recognition on mount
  useEffect(() => {
    SpeechService.initRecognition(
      (transcript) => {
        if (transcript.trim()) {
          handleSendMessage(transcript.trim());
        }
      },
      (listening) => {
        setIsListening(listening);
      }
    );
  }, [persona, apiKey, voiceSettings]);

  // Connect Call Handler
  const handleAcceptCall = () => {
    setCallState('connected');
    const initialGreeting = 'Olá! Conexão estabelecida com a unidade Amadeus. Aqui é Makise Kurisu do Laboratório 304. O que você gostaria de discutir hoje?';
    setCurrentSubtitle(initialGreeting);
    setCurrentEmotion('smile');

    if (voiceSettings.enabled && voiceSettings.autoSpeak) {
      SpeechService.speak(initialGreeting, {
        voiceURI: voiceSettings.voiceURI,
        rate: voiceSettings.rate,
        pitch: voiceSettings.pitch,
        volume: voiceSettings.volume,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    }
  };

  // Disconnect Call Handler
  const handleEndCall = () => {
    SpeechService.stopSpeaking();
    setIsSpeaking(false);
    setIsListening(false);
    setCallState('disconnected');
  };

  // Re-dial Call
  const handleRestartCall = () => {
    setCallState('incoming');
  };

  // Send message to Amadeus
  const handleSendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || isProcessing) return;

    // 1. Retrieve active memories from cognitive cortex (Local RAG)
    const matched = MemoryService.matchMemories(userMessage, persona);
    setRecalledMemoryIds(matched.map((m) => m.id));

    setIsProcessing(true);
    SpeechService.stopSpeaking();
    setIsSpeaking(false);

    try {
      // 2. Query Amadeus (Gemini API or Smart Offline Steins;Gate Engine)
      const result = await AIService.queryAmadeus(userMessage, persona, matched, apiKey);

      setCurrentSubtitle(result.response);
      setCurrentEmotion(result.emotion);

      // 3. Speak response with TTS if enabled
      if (voiceSettings.enabled && voiceSettings.autoSpeak) {
        SpeechService.speak(result.response, {
          voiceURI: voiceSettings.voiceURI,
          rate: voiceSettings.rate,
          pitch: voiceSettings.pitch,
          volume: voiceSettings.volume,
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
        });
      }
    } catch (err) {
      console.error('Error during query:', err);
      setCurrentSubtitle('Erro temporário no córtex digital. Verifique sua conexão ou tente novamente.');
      setCurrentEmotion('annoyed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Render Incoming Call Screen
  if (callState === 'incoming') {
    return (
      <IncomingCallScreen
        persona={persona}
        onAccept={handleAcceptCall}
        onDecline={() => setCallState('disconnected')}
        scanlines={scanlines}
      />
    );
  }

  // Render Disconnected Screen
  if (callState === 'disconnected') {
    return (
      <div className="relative w-full h-screen flex flex-col items-center justify-center p-6 bg-[#060a08] font-mono text-center select-none">
        <div className="p-8 rounded-xl border border-amadeus-border bg-amadeus-panel/80 max-w-md w-full space-y-5 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <div className="text-amadeus-red font-bold text-lg tracking-widest text-glow-red">
            CHAMADA ENCERRADA
          </div>
          <div className="text-xs text-amadeus-muted">
            A conexão com o servidor Amadeus na Viktor Chondria University foi finalizada.
          </div>
          <button
            onClick={handleRestartCall}
            className="w-full py-3 rounded-lg bg-amadeus-accent/20 border border-amadeus-accent text-amadeus-accent font-bold text-sm hover:bg-amadeus-accent hover:text-black transition-all flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4" />
            <span>LIGAR NOVAMENTE PARA O AMADEUS</span>
          </button>
        </div>
        {scanlines && <div className="absolute inset-0 crt-scanlines pointer-events-none" />}
      </div>
    );
  }

  // Render Active Call Screen
  return (
    <div className="relative w-full h-screen flex flex-col justify-between bg-[#060a08] overflow-hidden select-none font-mono">
      {/* Top Header */}
      <CallHeader
        isCalling={true}
        hasApiKey={Boolean(apiKey && apiKey.length > 10)}
        personaName={persona.name}
      />

      {/* Center Character Stage */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden flex items-center justify-center">
        {/* Visual Novel Character Sprite with Blinking & Lip Sync */}
        <AmadeusSpriteView
          emotion={currentEmotion}
          isSpeaking={isSpeaking}
          scanlines={scanlines}
        />

        {/* Floating Audio Oscilloscope (Steins;Gate Frequency Monitor) */}
        <div className="absolute bottom-4 right-4 w-72 md:w-80 z-20 hidden sm:block shadow-lg">
          <AudioOscilloscope
            isActive={isSpeaking}
            isListening={isListening}
          />
        </div>
      </div>

      {/* Bottom Interface: Subtitles & Control Bar */}
      <div className="w-full bg-gradient-to-t from-[#040705] via-[#070c09]/95 to-transparent px-4 pb-2 z-30">
        <SubtitleBox
          speakerName={persona.name}
          text={currentSubtitle}
          emotion={currentEmotion}
          isProcessing={isProcessing}
          onTopicClick={handleSendMessage}
        />

        <ControlBar
          onSendMessage={handleSendMessage}
          isListening={isListening}
          onToggleMic={() => SpeechService.toggleListening()}
          voiceEnabled={voiceSettings.enabled}
          onToggleVoice={() => {
            const next = !voiceSettings.enabled;
            if (!next) SpeechService.stopSpeaking();
            handleSaveVoiceSettings({ ...voiceSettings, enabled: next });
          }}
          onOpenMemory={() => setIsMemoryModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onEndCall={handleEndCall}
          disabled={isProcessing}
        />
      </div>

      {/* Memory Cortex Inspector Modal */}
      <MemoryInspectorModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        persona={persona}
        recalledMemoryIds={recalledMemoryIds}
        onMemoryAdded={() => setPersona(MemoryService.getPersona(persona.id))}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        voiceSettings={voiceSettings}
        onSaveVoiceSettings={handleSaveVoiceSettings}
        scanlines={scanlines}
        onToggleScanlines={handleToggleScanlines}
      />
    </div>
  );
};
