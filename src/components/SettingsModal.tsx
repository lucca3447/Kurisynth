import React, { useState, useEffect } from 'react';
import { Settings, Key, Volume2, Monitor, HelpCircle, X, Check, Zap, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
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
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [showRvcAdvanced, setShowRvcAdvanced] = useState(false);

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    const sampleText = voiceSettings.engine === 'qwen3'
      ? 'Não precisa me envergonhar assim... seu idiota!'
      : voiceSettings.neuralVoice?.startsWith('ja-JP')
        ? 'こんにちは！アマデウス紅莉栖です。神経接続完了！'
        : voiceSettings.useRvc
          ? 'Olá! Conexão neural RVC estabelecida. Este é o timbre digitalizado de Makise Kurisu!'
          : 'Olá! Conexão Amadeus estabelecida. Teste de voz e sincronia labial em cem por cento!';
    await SpeechService.speak(sampleText, {
      voiceURI: voiceSettings.voiceURI,
      rate: voiceSettings.rate,
      pitch: voiceSettings.pitch,
      volume: voiceSettings.volume,
      engine: voiceSettings.engine || 'edge_rvc',
      emotion: 'tsundere',
      useNeural: voiceSettings.useNeural !== false,
      neuralVoice: voiceSettings.neuralVoice || 'pt-BR-FranciscaNeural',
      useRvc: Boolean(voiceSettings.useRvc),
      rvcPitch: voiceSettings.rvcPitch ?? 0,
      rvcIndexRate: voiceSettings.rvcIndexRate ?? 0.75,
      onEnd: () => setIsTestingVoice(false),
    });
  };

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
          {/* Section: Groq, Gemini & OpenRouter API Key */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Key className="w-3.5 h-3.5 text-amadeus-accent" />
              <span>CHAVE DE API (GROQ, GEMINI OU OPENROUTER)</span>
            </div>
            <p className="text-[11px] text-amadeus-muted leading-relaxed font-sans">
              Recomendado: <strong>Groq Cloud</strong> (<code className="text-amadeus-accent">gsk_...</code> com LPU ultra-rápida e Llama 3.3 70B), <strong>Google Gemini</strong> (<code className="text-amadeus-accent">AIzaSy...</code>) ou <strong>OpenRouter</strong> (<code className="text-amadeus-accent">sk-or-...</code>).
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="Cole sua API Key aqui (gsk_... / AIzaSy... / sk-or-...)"
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
            <div className="flex flex-col gap-1 text-[10px] text-amadeus-muted pt-1">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-3 h-3 text-amadeus-accent shrink-0" />
                <span>Pegar chave grátis: <strong>Groq Cloud</strong> (console.groq.com), <strong>Google AI Studio</strong> (aistudio.google.com) ou <strong>OpenRouter</strong> (openrouter.ai).</span>
              </div>
              <span className="text-[10px] text-amadeus-muted/80 pl-4">Deixe em branco para usar o <strong>Simulador Offline Autônomo</strong>.</span>
            </div>
          </div>

          {/* Section: Voice & Speech Settings */}
          <div className="space-y-3 pt-3 border-t border-amadeus-border/60">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Volume2 className="w-3.5 h-3.5 text-amadeus-accent" />
              <span>CONFIGURAÇÃO DE VOZ (SPEECH SYNTHESIS)</span>
            </div>

            {/* Engine Selection: Qwen3-TTS vs Edge-TTS + RVC */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-amadeus-muted block">Motor de Síntese Vocal:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSaveVoiceSettings({ ...voiceSettings, engine: 'qwen3' })}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    voiceSettings.engine === 'qwen3'
                      ? 'border-amadeus-accent bg-amadeus-accent/15 text-white shadow-sm shadow-amadeus-accent/20'
                      : 'border-amadeus-border bg-amadeus-card/60 text-amadeus-muted hover:border-amadeus-muted'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amadeus-accent">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Kurisu Qwen3-TTS</span>
                  </div>
                  <p className="text-[9px] mt-0.5 text-amadeus-muted">
                    End-to-End Neural (RTX 3050 | Suspiros & Tsundere)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onSaveVoiceSettings({ ...voiceSettings, engine: 'edge_rvc' })}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    voiceSettings.engine !== 'qwen3'
                      ? 'border-amadeus-accent bg-amadeus-accent/15 text-white shadow-sm shadow-amadeus-accent/20'
                      : 'border-amadeus-border bg-amadeus-card/60 text-amadeus-muted hover:border-amadeus-muted'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amadeus-accent">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Edge-TTS + RVC</span>
                  </div>
                  <p className="text-[9px] mt-0.5 text-amadeus-muted">
                    Híbrido Leve (Dicção PT-BR pura + Timbre)
                  </p>
                </button>
              </div>
            </div>

            {voiceSettings.engine === 'qwen3' ? (
              <div className="p-3 rounded-lg border border-amadeus-accent/30 bg-amadeus-card/90 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amadeus-accent">
                    <Sparkles className="w-3.5 h-3.5 text-amadeus-accent" />
                    <span>QWEN3-TTS KURISU (RESIDENT GPU)</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amadeus-accent/10 border border-amadeus-accent/30 text-amadeus-accent">
                    CUDA BF16 (RTX 3050)
                  </span>
                </div>
                <p className="text-[10px] text-amadeus-muted leading-relaxed">
                  Síntese direta ponta a ponta na voz da Kurisu. As entonações, pausas e suspiros tsundere reagem dinamicamente às emoções da tela com acústica de estúdio seco.
                </p>
              </div>
            ) : (
              <>
                {/* Neural vs System Voice selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-white font-medium block">Voz Neural de Alta Definição (Edge-TTS)</span>
                      <span className="text-[10px] text-amadeus-muted">Voz humana com sincronia labial acústica</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={voiceSettings.useNeural !== false}
                      onChange={(e) => onSaveVoiceSettings({ ...voiceSettings, useNeural: e.target.checked })}
                      className="accent-amadeus-accent w-4 h-4 cursor-pointer"
                    />
                  </div>

                  {voiceSettings.useNeural !== false ? (
                    <div className="space-y-1">
                      <label className="text-[10px] text-amadeus-muted block">Voz Neural (IA):</label>
                      <select
                        value={voiceSettings.neuralVoice || 'pt-BR-FranciscaNeural'}
                        onChange={(e) => onSaveVoiceSettings({ ...voiceSettings, neuralVoice: e.target.value })}
                        className="w-full h-8 px-2 rounded bg-amadeus-card border border-amadeus-border text-xs text-white focus:outline-none focus:border-amadeus-accent"
                      >
                        <option value="pt-BR-FranciscaNeural">Francisca Neural (Português BR - Natural & Expressiva)</option>
                        <option value="pt-BR-ThalitaNeural">Thalita Neural (Português BR - Jovem & Rápida)</option>
                        <option value="pt-BR-ElzaNeural">Elza Neural (Português BR - Calma & Séria)</option>
                        <option value="ja-JP-NanamiNeural">Nanami Neural (Japonês - Anime Original)</option>
                        <option value="ja-JP-AoiNeural">Aoi Neural (Japonês - Calma)</option>
                        <option value="en-US-JennyNeural">Jenny Neural (Inglês - Cientista Viktor Chondria)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] text-amadeus-muted block">Voz do Sistema (Navegador):</label>
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
                  )}
                </div>

                {/* RVC Neural Voice Card (RTX 3050 GPU Acceleration) */}
                <div className="p-3 rounded-lg border border-amadeus-accent/30 bg-amadeus-card/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amadeus-accent">
                        <Sparkles className="w-3.5 h-3.5 text-amadeus-accent" />
                        <span>CLONAGEM DE VOZ RVC (KURISU)</span>
                      </div>
                      <p className="text-[10px] text-amadeus-muted mt-0.5">
                        Timbre da dubladora original acelerado na GPU RTX 3050 (FP16)
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(voiceSettings.useRvc)}
                      onChange={(e) =>
                        onSaveVoiceSettings({
                          ...voiceSettings,
                          useRvc: e.target.checked,
                          useNeural: true,
                        })
                      }
                      className="accent-amadeus-accent w-4 h-4 cursor-pointer"
                    />
                  </div>

                  {voiceSettings.useRvc && (
                    <div className="space-y-2 pt-1 border-t border-amadeus-border/40">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setShowRvcAdvanced((prev) => !prev)}
                          className="text-[10px] text-amadeus-accent hover:underline flex items-center gap-1"
                        >
                          <span>{showRvcAdvanced ? '▼ Ocultar Ajustes Finos RVC' : '▶ Ajustes Finos de Tom & Timbre (Opcional)'}</span>
                        </button>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amadeus-accent/10 border border-amadeus-accent/30 text-amadeus-accent">
                          CUDA FP16
                        </span>
                      </div>

                      {showRvcAdvanced && (
                        <div className="grid grid-cols-2 gap-3 pt-2 text-[10px]">
                          <div>
                            <label className="text-amadeus-muted block mb-1">
                              Afinação / Pitch ({voiceSettings.rvcPitch ?? 0} semitons):
                            </label>
                            <input
                              type="range"
                              min="-6"
                              max="6"
                              step="1"
                              value={voiceSettings.rvcPitch ?? 0}
                              onChange={(e) =>
                                onSaveVoiceSettings({
                                  ...voiceSettings,
                                  rvcPitch: parseInt(e.target.value, 10),
                                })
                              }
                              className="w-full accent-amadeus-accent cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="text-amadeus-muted block mb-1">
                              Fidelidade de Timbre ({Math.round((voiceSettings.rvcIndexRate ?? 0.75) * 100)}%):
                            </label>
                            <input
                              type="range"
                              min="0.2"
                              max="1.0"
                              step="0.05"
                              value={voiceSettings.rvcIndexRate ?? 0.75}
                              onChange={(e) =>
                                onSaveVoiceSettings({
                                  ...voiceSettings,
                                  rvcIndexRate: parseFloat(e.target.value),
                                })
                              }
                              className="w-full accent-amadeus-accent cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Sample audio preview button */}
            <button
              type="button"
              onClick={handleTestVoice}
              disabled={isTestingVoice}
              className="w-full h-8 rounded border border-amadeus-accent/40 bg-amadeus-accent/10 hover:bg-amadeus-accent hover:text-black text-amadeus-accent text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isTestingVoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isTestingVoice ? 'Reproduzindo Amostra...' : 'Ouvir Amostra de Voz'}</span>
            </button>

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
