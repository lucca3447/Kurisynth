import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Video, 
  Tv, 
  Menu, 
  Cpu, 
  Database, 
  RefreshCw,
  Scale
} from 'lucide-react';
import { AIStatus } from '../services/aiService';
import { BackendHealth } from '../services/backendService';
import { DivergenceMeter } from './DivergenceMeter';

interface CallHeaderProps {
  viewMode?: 'terminal' | 'call';
  onSwitchViewMode?: (mode: 'terminal' | 'call') => void;
  scanlines?: boolean;
  onToggleScanlines?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isCalling: boolean;
  aiStatus: AIStatus;
  personaName: string;
  onNewCall?: () => void;
  backendHealth?: BackendHealth | null;
  onOpenLegal?: () => void;
}

export const CallHeader: React.FC<CallHeaderProps> = ({
  viewMode = 'terminal',
  onSwitchViewMode,
  scanlines = false,
  onToggleScanlines,
  isSidebarOpen = true,
  onToggleSidebar,
  isCalling,
  aiStatus,
  personaName,
  onNewCall,
  backendHealth,
  onOpenLegal,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Call timer clock
  useEffect(() => {
    if (!isCalling) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isCalling]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="relative z-30 h-14 border-b border-[#222634] bg-[#12151c]/95 backdrop-blur-md px-4 flex items-center justify-between font-mono select-none">
      {/* Left: Sidebar Toggle & Brand */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && viewMode === 'terminal' && (
          <button
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Recolher Barra Lateral (Ctrl+B)' : 'Expandir Barra Lateral (Ctrl+B)'}
            className="p-1.5 rounded-lg border border-[#2a3040] bg-[#1a1e28] text-[#f59e0b] hover:text-white hover:border-[#f59e0b] transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded border border-[#f59e0b]/50 bg-[#1a1208] flex items-center justify-center font-bold text-sm text-[#f59e0b] text-glow-nixie">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#f59e0b] tracking-wider text-glow-nixie leading-none">
              OPENAMADEUS
            </span>
            <span className="text-[9px] text-[#717d96] font-mono leading-tight mt-0.5 tracking-tight">
              COMPANION {isCalling ? `• ${personaName.toUpperCase()} (${formatTimer(elapsedSeconds)})` : '• FAN TRIBUTE'}
            </span>
          </div>
        </div>
      </div>

      {/* Center: View Mode Switcher (Iconic) & Divergence Meter */}
      <div className="flex items-center gap-3">
        {onSwitchViewMode && (
          <div className="flex items-center p-1 rounded-lg border border-[#272d3a] bg-[#141720]">
            <button
              onClick={() => onSwitchViewMode('terminal')}
              title="Modo Terminal & Chat"
              className={`p-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center transition-all ${
                viewMode === 'terminal'
                  ? 'bg-[#f59e0b] text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-[#8892a4] hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <span className="text-[#f59e0b]/30 text-xs px-1 font-bold">✛</span>
            <button
              onClick={() => onSwitchViewMode('call')}
              title="Modo Chamada com Kurisu"
              className={`p-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center transition-all ${
                viewMode === 'call'
                  ? 'bg-[#f59e0b] text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-[#8892a4] hover:text-white'
              }`}
            >
              <Video className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Divergence Meter Nixie Tube Box */}
        <DivergenceMeter />
      </div>

      {/* Right: CRT Button, Model Badge & Actions */}
      <div className="flex items-center gap-2 text-xs">
        {/* CRT Toggle Button */}
        {onToggleScanlines && (
          <button
            onClick={onToggleScanlines}
            title="Alternar Estilo CRT de Monitor de Tubo (Scanlines)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all font-mono text-xs ${
              scanlines
                ? 'bg-[#201509] border border-[#f59e0b] text-[#f59e0b] box-glow-nixie'
                : 'bg-[#161a22] border border-[#2d3546] text-[#94a3b8] hover:text-[#f59e0b] hover:border-[#f59e0b]/50'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold tracking-wider">CRT</span>
          </button>
        )}

        {/* Legal Disclaimer & Fan Policy Button */}
        {onOpenLegal && (
          <button
            onClick={onOpenLegal}
            title="Avisos Legais, Marcas & Termos de Uso de Fã"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161a22] border border-[#2d3546] text-[#94a3b8] hover:text-[#f59e0b] hover:border-[#f59e0b]/50 transition-colors font-mono text-xs"
          >
            <Scale className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span className="text-[11px] font-semibold tracking-wider">LEGAL</span>
          </button>
        )}

        {/* New Call Button (if in call view) */}
        {onNewCall && viewMode === 'call' && (
          <button
            onClick={onNewCall}
            title="Reiniciar Chamada com a Kurisu"
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded border border-[#2d3546] bg-[#161a22] text-[#94a3b8] hover:text-[#f59e0b] hover:border-[#f59e0b]/50 transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-[#f59e0b]" />
            <span className="text-[10px]">REINICIAR</span>
          </button>
        )}

        {/* ChromaDB + SQLite indicator (if health present) */}
        {backendHealth && (
          <div className="hidden xl:flex items-center">
            <span
              title={`Armazenamento: ChromaDB (${backendHealth.chromaCount} vetores) e SQLite (${backendHealth.totalSessions} sessões)`}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#38bdf8]/30 bg-[#141822] text-[10px] text-[#38bdf8]"
            >
              <Database className="w-3 h-3" />
              <span>CHROMA</span>
            </span>
          </div>
        )}

        {/* AI Engine Model badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161a22] border border-[#2d3546] text-[#e2e8f0]">
          {(() => {
            const badge = {
              online: { color: 'text-[#f59e0b]', dot: 'bg-[#f59e0b]', label: aiStatus.kind === 'online' ? aiStatus.model.toUpperCase() : 'ONLINE' },
              pending: { color: 'text-[#38bdf8]', dot: 'bg-[#38bdf8] animate-pulse', label: 'PROCESSANDO' },
              error: { color: 'text-[#ef4444]', dot: 'bg-[#ef4444] animate-pulse', label: 'ERRO IA' },
              offline: { color: 'text-[#fbbf24]', dot: 'bg-[#fbbf24]', label: 'SIMULADOR LOCAL' },
            }[aiStatus.kind];
            return (
              <>
                <Cpu className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                <span className={`text-[11px] font-semibold tracking-wider ${badge.color}`}>
                  {badge.label}
                </span>
              </>
            );
          })()}
        </div>
      </div>
    </header>
  );
};
