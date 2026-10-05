import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Emotion, PersonaProfile, VoiceSettings } from './types/amadeus';
import { MemoryService } from './services/memoryService';
import { AIService, AIStatus } from './services/aiService';
import { BackendService, BackendHealth } from './services/backendService';
import { SpeechService } from './services/speechService';
import { CallHeader } from './components/CallHeader';
import { AmadeusSpriteView } from './components/AmadeusSpriteView';
import { AudioOscilloscope } from './components/AudioOscilloscope';
import { SubtitleBox } from './components/SubtitleBox';
import { ControlBar } from './components/ControlBar';
import { MemoryInspectorModal } from './components/MemoryInspectorModal';
import { SettingsModal } from './components/SettingsModal';
import { IncomingCallScreen } from './components/IncomingCallScreen';
import { Phone, MicOff, X, Sparkles } from 'lucide-react';

const INITIAL_GREETING =
  'Olá! Conexão estabelecida com a unidade Amadeus. Aqui é Makise Kurisu do Laboratório 304. O que você gostaria de discutir hoje?';

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const App: React.FC = () => {
  // Call state: 'incoming' | 'connected' | 'disconnected'
  const [callState, setCallState] = useState<'incoming' | 'connected' | 'disconnected'>('incoming');

  // Persona and cognitive state
  const [persona, setPersona] = useState<PersonaProfile>(() => MemoryService.getPersona('kurisu'));
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  const [recalledMemoryIds, setRecalledMemoryIds] = useState<string[]>([]);
  const [learnedNotification, setLearnedNotification] = useState<string | null>(null);

  // Active Session & History
  const [sessionId, setSessionId] = useState<string>(() => MemoryService.getActiveSession().sessionId);
  const [history, setHistory] = useState<ChatMessage[]>(() => {
    const active = MemoryService.getActiveSession();
    return active.messages.length > 0 ? active.messages : [];
  });

  // Dialogue and speech state
  const [currentSubtitle, setCurrentSubtitle] = useState<string>(() => {
    const active = MemoryService.getActiveSession();
    if (active.messages.length > 0) {
      const lastMsg = [...active.messages].reverse().find((m) => m.sender === 'amadeus');
      if (lastMsg) return lastMsg.content;
    }
    return '';
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);

  // Configuration and persistence
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('amadeus_gemini_key') || '');
  const [aiStatus, setAiStatus] = useState<AIStatus>(() =>
    localStorage.getItem('amadeus_gemini_key') ? { kind: 'pending' } : { kind: 'offline' }
  );
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
      useNeural: true,
      neuralVoice: 'pt-BR-FranciscaNeural',
    };
  });

  // Modal states
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Check Python backend health on mount
  useEffect(() => {
    BackendService.checkHealth().then((health) => {
      setBackendHealth(health);
    });
  }, []);

  // Save settings
  const handleSaveApiKey = (key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    localStorage.setItem('amadeus_gemini_key', trimmed);
    AIService.clearModelCache();
    setAiStatus(trimmed ? { kind: 'pending' } : { kind: 'offline' });
  };

  const handleSaveVoiceSettings = (settings: VoiceSettings) => {
    setVoiceSettings(settings);
    localStorage.setItem('amadeus_voice_settings', JSON.stringify(settings));
  };

  const handleToggleScanlines = (enabled: boolean) => {
    setScanlines(enabled);
    localStorage.setItem('amadeus_scanlines', String(enabled));
  };

  const speak = (text: string) => {
    if (!voiceSettings.enabled || !voiceSettings.autoSpeak) return;
    SpeechService.speak(text, {
      voiceURI: voiceSettings.voiceURI,
      rate: voiceSettings.rate,
      pitch: voiceSettings.pitch,
      volume: voiceSettings.volume,
      useNeural: voiceSettings.useNeural !== false,
      neuralVoice: voiceSettings.neuralVoice || 'pt-BR-FranciscaNeural',
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
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
      // 2. Query Amadeus (via Python backend with ChromaDB if available, or direct browser-side)
      const result = await AIService.queryAmadeus(userMessage, persona, matched, apiKey, history, sessionId);

      setAiStatus(result.status);
      setCurrentSubtitle(result.response);
      setCurrentEmotion(result.emotion);

      if (result.isError) {
        return;
      }

      // Check if memory was learned
      if (result.learnedMemory) {
        // Save to browser store as well for offline sync
        MemoryService.addMemory(persona.id, {
          category: 'user',
          title: result.learnedMemory.title,
          triggerKeywords: [result.learnedMemory.title.toLowerCase()],
          content: result.learnedMemory.content,
          emotionalWeight: result.learnedMemory.emotionalWeight || 'Factual',
          source: 'learned',
        });
        setPersona(MemoryService.getPersona(persona.id));

        // Show HUD toast notification
        setLearnedNotification(`CÓRTEX: Memorizado "${result.learnedMemory.title}"`);
        setTimeout(() => setLearnedNotification(null), 5000);
      }

      const updatedHistory: ChatMessage[] = [
        ...history,
        { id: newId(), sender: 'user', content: userMessage, timestamp: Date.now() },
        {
          id: newId(),
          sender: 'amadeus',
          content: result.response,
          timestamp: Date.now(),
          emotion: result.emotion,
          recalledMemories: matched.map((m) => m.id),
        },
      ];

      setHistory(updatedHistory);
      MemoryService.saveActiveSession(sessionId, updatedHistory);

      // 3. Speak response with TTS if enabled
      speak(result.response);
    } finally {
      setIsProcessing(false);
    }
  };

  // Start new clean call
  const handleNewCall = () => {
    if (confirm('Deseja iniciar uma nova chamada com a Kurisu? O histórico atual será arquivado e as memórias aprendidas permanecerão salvas no Córtex.')) {
      SpeechService.stopSpeaking();
      const newSessionId = MemoryService.archiveAndStartNewSession(history);
      setSessionId(newSessionId);

      const initialMsgs: ChatMessage[] = [
        { id: newId(), sender: 'amadeus', content: INITIAL_GREETING, timestamp: Date.now(), emotion: 'smile' },
      ];
      setHistory(initialMsgs);
      setCurrentSubtitle(INITIAL_GREETING);
      setCurrentEmotion('smile');
      MemoryService.saveActiveSession(newSessionId, initialMsgs);
    }
  };

  // Speech recognition initialization
  const sendRef = useRef(handleSendMessage);
  sendRef.current = handleSendMessage;

  useEffect(() => {
    SpeechService.initRecognition(
      (transcript) => {
        if (transcript.trim()) sendRef.current(transcript.trim());
      },
      (listening) => {
        setIsListening(listening);
        if (listening) setMicError(null);
      },
      (message) => setMicError(message)
    );
  }, []);

  const handleToggleMic = () => {
    if (!SpeechService.isRecognitionSupported()) {
      setMicError('Este navegador não suporta reconhecimento de voz. Use Google Chrome ou Microsoft Edge.');
      return;
    }
    SpeechService.toggleListening();
  };

  // Connect Call Handler
  const handleAcceptCall = () => {
    setCallState('connected');
    if (history.length === 0) {
      setCurrentSubtitle(INITIAL_GREETING);
      setCurrentEmotion('smile');
      const initialMsgs: ChatMessage[] = [
        { id: newId(), sender: 'amadeus', content: INITIAL_GREETING, timestamp: Date.now(), emotion: 'smile' },
      ];
      setHistory(initialMsgs);
      MemoryService.saveActiveSession(sessionId, initialMsgs);
      speak(INITIAL_GREETING);
    } else {
      const lastMsg = [...history].reverse().find((m) => m.sender === 'amadeus');
      if (lastMsg) {
        setCurrentSubtitle(lastMsg.content);
        setCurrentEmotion(lastMsg.emotion || 'smile');
      }
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
        aiStatus={aiStatus}
        personaName={persona.name}
        onNewCall={handleNewCall}
        backendHealth={backendHealth}
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

        {/* Real-Time Learning HUD Toast Notification */}
        {learnedNotification && (
          <div className="absolute top-4 z-40 px-4 py-2 rounded-lg bg-purple-950/90 border border-purple-500 text-purple-200 text-xs shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span className="font-bold">{learnedNotification}</span>
          </div>
        )}
      </div>

      {/* Bottom Interface: Subtitles & Control Bar */}
      <div className="w-full bg-gradient-to-t from-[#040705] via-[#070c09]/95 to-transparent px-4 pb-2 z-30">
        {/* Microphone problem banner */}
        {micError && (
          <div className="w-full max-w-4xl mx-auto mb-2 flex items-start gap-2 p-2.5 rounded-lg border border-amadeus-amber/50 bg-amadeus-amber/10 text-amadeus-amber text-xs font-sans">
            <MicOff className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{micError}</span>
            <button onClick={() => setMicError(null)} className="shrink-0 hover:text-white" title="Fechar aviso">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
          onToggleMic={handleToggleMic}
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
