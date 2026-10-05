import React, { useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Database, 
  Settings, 
  PhoneOff, 
  Send,
  Sparkles
} from 'lucide-react';

interface ControlBarProps {
  onSendMessage: (message: string) => void;
  isListening: boolean;
  onToggleMic: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onEndCall: () => void;
  disabled?: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  onSendMessage,
  isListening,
  onToggleMic,
  voiceEnabled,
  onToggleVoice,
  onOpenMemory,
  onOpenSettings,
  onEndCall,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || disabled) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-2 pt-2 pb-3 px-2 z-30 select-none">
      {/* Text Input Form */}
      <form onSubmit={handleSend} className="w-full flex-1 flex items-center relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isListening ? 'Escutando sua voz...' : 'Digite sua mensagem para o Amadeus...'}
          disabled={disabled}
          className="w-full h-11 pl-4 pr-12 rounded-lg bg-amadeus-panel border border-amadeus-border text-sm text-[#e0f0e8] placeholder-amadeus-muted/60 focus:outline-none focus:border-amadeus-accent/80 focus:ring-1 focus:ring-amadeus-accent/50 font-sans transition-all"
        />
        <button
          type="submit"
          disabled={disabled || !inputValue.trim()}
          title="Enviar Mensagem (Enter)"
          className="absolute right-1.5 w-8 h-8 rounded flex items-center justify-center bg-amadeus-border/60 hover:bg-amadeus-accent hover:text-black text-amadeus-accent transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-amadeus-accent"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Action Buttons Toolbar */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Microphone STT */}
        <button
          type="button"
          onClick={onToggleMic}
          disabled={disabled}
          title={isListening ? 'Parar Microfone' : 'Falar no Microfone (STT Grátis)'}
          className={`h-11 px-3 rounded-lg border font-mono text-xs flex items-center gap-1.5 transition-all ${
            isListening 
              ? 'bg-amadeus-cyan/20 border-amadeus-cyan text-amadeus-cyan shadow-[0_0_12px_rgba(56,225,255,0.4)] animate-pulse' 
              : 'bg-amadeus-panel border-amadeus-border text-amadeus-muted hover:text-amadeus-accent hover:border-amadeus-accent/60'
          }`}
        >
          {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          <span className="hidden md:inline">{isListening ? 'OUVINDO...' : 'MIC'}</span>
        </button>

        {/* TTS Voice Toggle */}
        <button
          type="button"
          onClick={onToggleVoice}
          title={voiceEnabled ? 'Voz Ativada (Clique para silenciar)' : 'Voz Silenciada (Clique para ativar)'}
          className={`h-11 px-3 rounded-lg border font-mono text-xs flex items-center gap-1.5 transition-all ${
            voiceEnabled 
              ? 'bg-[#0f241a] border-amadeus-accent text-amadeus-accent shadow-[0_0_10px_rgba(0,255,136,0.2)]' 
              : 'bg-amadeus-panel border-amadeus-border text-amadeus-muted hover:text-[#d0e5da]'
          }`}
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4 text-amadeus-accent" /> : <VolumeX className="w-4 h-4" />}
          <span className="hidden md:inline">VOZ</span>
        </button>

        {/* Memory Cortex Inspector */}
        <button
          type="button"
          onClick={onOpenMemory}
          title="Inspecionar Banco de Memórias Digitalizadas"
          className="h-11 px-3 rounded-lg bg-amadeus-panel border border-amadeus-border text-amadeus-muted hover:text-amadeus-accent hover:border-amadeus-accent/60 transition-colors flex items-center gap-1.5 font-mono text-xs"
        >
          <Database className="w-4 h-4 text-amadeus-accent/80" />
          <span className="hidden md:inline">CÓRTEX</span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Configurações do Sistema"
          className="h-11 px-3 rounded-lg bg-amadeus-panel border border-amadeus-border text-amadeus-muted hover:text-amadeus-accent hover:border-amadeus-accent/60 transition-colors flex items-center justify-center"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* End Call */}
        <button
          type="button"
          onClick={onEndCall}
          title="Encerrar Conexão com o Amadeus"
          className="h-11 px-3.5 rounded-lg bg-amadeus-red/20 border border-amadeus-red/60 text-amadeus-red hover:bg-amadeus-red hover:text-white transition-all flex items-center gap-1.5 font-mono text-xs font-bold"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="hidden md:inline">ENCERRAR</span>
        </button>
      </div>
    </div>
  );
};
