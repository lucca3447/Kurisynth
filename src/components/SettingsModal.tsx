import React, { useState, useEffect } from 'react';
import { Settings, Key, Volume2, Monitor, HelpCircle, X, Check, Zap, Loader2, AlertTriangle } from 'lucide-react';
import { VoiceSettings } from '../types/amadeus';
import { SpeechService } from '../services/speechService';
import { AIService } from '../services/aiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  voiceSettings: VoiceSettings;
  onSaveVoiceSettings: (settings: VoiceSettings) => void;
  scanlines: boolean;
  onToggleScanlines: (enabled: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  voiceSettings,
  onSaveVoiceSettings,
  scanlines,
  onToggleScanlines,
}) => {
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await AIService.testConnection(tempApiKey);
    setTestResult(result);
    setIsTesting(false);
  };

  useEffect(() => {
    setTempApiKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    SpeechService.getAvailableVoices().then((voices) => {
      setAvailableVoices(voices);
    });
  }, []);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(tempApiKey.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-xl bg-amadeus-panel border border-amadeus-border shadow-[0_0_40px_rgba(0,0,0,0.9)] overflow-hidden font-mono text-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amadeus-border bg-amadeus-card">
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-amadeus-accent" />
            <h2 className="text-sm font-bold text-amadeus-accent tracking-wider text-glow-green">
              CONFIGURAÇÕES DO SISTEMA // AMADEUS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-amadeus-muted hover:text-white hover:bg-amadeus-border/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section: Gemini API Key */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Key className="w-3.5 h-3.5 text-amadeus-accent" />
              <span>CHAVE GOOGLE GEMINI (PLANO GRATUITO)</span>
            </div>
            <p className="text-[11px] text-amadeus-muted leading-relaxed font-sans">
              Insira sua chave do Google AI Studio para raciocínio em nuvem ilimitado no plano Free Tier (sem necessidade de cartão de crédito).
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="Cole sua API Key aqui (AIzaSy...)"
                value={tempApiKey}
                onChange={(e) => {
                  setTempApiKey(e.target.value);
                  setTestResult(null);
                }}
                className="flex-1 h-9 px-3 rounded bg-amadeus-card border border-amadeus-border text-xs text-white placeholder-amadeus-muted/50 focus:outline-none focus:border-amadeus-accent"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || !tempApiKey.trim()}
                className="h-9 px-3 rounded border border-amadeus-accent/60 text-amadeus-accent text-xs flex items-center gap-1.5 hover:bg-amadeus-accent hover:text-black transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-amadeus-accent shrink-0"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
              </button>
            </div>
            {testResult && (
              <div
                className={`flex items-start gap-1.5 text-[11px] p-2 rounded border font-sans ${
                  testResult.ok
                    ? 'text-amadeus-accent border-amadeus-accent/40 bg-amadeus-accent/10'
                    : 'text-amadeus-red border-amadeus-red/40 bg-amadeus-red/10'
                }`}
              >
                {testResult.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                <span>
                  {testResult.message}
                  {testResult.ok && ' — clique em "Salvar Alterações" para usar.'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-amadeus-muted">
              <HelpCircle className="w-3 h-3 text-amadeus-accent shrink-0" />
              <span>Deixe em branco para usar o <strong>Simulador Offline Autônomo</strong> (R$ 0,00).</span>
            </div>
          </div>

          {/* Section: Voice & Speech Settings */}
          <div className="space-y-3 pt-3 border-t border-amadeus-border/60">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Volume2 className="w-3.5 h-3.5 text-amadeus-accent" />
              <span>CONFIGURAÇÃO DE VOZ (SPEECH SYNTHESIS)</span>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-amadeus-muted block">Voz do Sistema (Navegador):</label>
              <select
                value={voiceSettings.voiceURI || ''}
                onChange={(e) => onSaveVoiceSettings({ ...voiceSettings, voiceURI: e.target.value })}
                className="w-full h-8 px-2 rounded bg-amadeus-card border border-amadeus-border text-xs text-white focus:outline-none focus:border-amadeus-accent"
              >
                <option value="">Padrão do Sistema</option>
                {availableVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-amadeus-muted">Falar Resposta Automaticamente:</span>
              <input
                type="checkbox"
                checked={voiceSettings.autoSpeak}
                onChange={(e) => onSaveVoiceSettings({ ...voiceSettings, autoSpeak: e.target.checked })}
                className="accent-amadeus-accent w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] text-amadeus-muted block mb-1">Velocidade ({voiceSettings.rate}x):</label>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.05"
                  value={voiceSettings.rate}
                  onChange={(e) => onSaveVoiceSettings({ ...voiceSettings, rate: parseFloat(e.target.value) })}
                  className="w-full accent-amadeus-accent cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[10px] text-amadeus-muted block mb-1">Tom / Pitch ({voiceSettings.pitch}):</label>
                <input
                  type="range"
                  min="0.8"
                  max="1.6"
                  step="0.05"
                  value={voiceSettings.pitch}
                  onChange={(e) => onSaveVoiceSettings({ ...voiceSettings, pitch: parseFloat(e.target.value) })}
                  className="w-full accent-amadeus-accent cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Section: Display Settings */}
          <div className="space-y-3 pt-3 border-t border-amadeus-border/60">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Monitor className="w-3.5 h-3.5 text-amadeus-accent" />
              <span>VISUAL & EFEITOS CRT</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-amadeus-muted">Linhas de Varredura CRT (Scanlines):</span>
              <input
                type="checkbox"
                checked={scanlines}
                onChange={(e) => onToggleScanlines(e.target.checked)}
                className="accent-amadeus-accent w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-amadeus-border bg-amadeus-card flex items-center justify-between">
          <span className="text-[11px] text-amadeus-muted">
            Configurações salvas localmente
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-amadeus-border/60 hover:bg-amadeus-border text-white text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded bg-amadeus-accent text-black font-bold text-xs flex items-center gap-1.5 hover:bg-[#00e676] transition-colors"
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{savedSuccess ? 'Salvo!' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
