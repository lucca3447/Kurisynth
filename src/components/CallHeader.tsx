import React, { useState, useEffect } from 'react';
import { Wifi, Cpu, ShieldCheck, Database, RefreshCw } from 'lucide-react';
import { AIStatus } from '../services/aiService';
import { BackendHealth } from '../services/backendService';

interface CallHeaderProps {
  isCalling: boolean;
  aiStatus: AIStatus;
  personaName: string;
  onNewCall?: () => void;
  backendHealth?: BackendHealth | null;
}

export const CallHeader: React.FC<CallHeaderProps> = ({
  isCalling,
  aiStatus,
  personaName,
  onNewCall,
  backendHealth,
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
    <header className="h-14 border-b border-amadeus-border bg-amadeus-panel/95 backdrop-blur px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Lab & System ID */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded border border-amadeus-accent/40 bg-amadeus-card flex items-center justify-center">
          <span className="text-amadeus-accent font-mono font-bold text-sm tracking-tighter">A</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amadeus-accent tracking-wider text-glow-green">
              AMADEUS OS v2.1.0
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amadeus-border/60 text-amadeus-muted font-mono">
              BUILD 2026.10
            </span>
          </div>
          <div className="text-[11px] font-mono text-amadeus-muted">
            VIKTOR CHONDRIA UNIVERSITY // LAB 304
          </div>
        </div>
      </div>

      {/* Center: Connection Status, Timer & Nova Chamada */}
      <div className="flex items-center gap-3">
        {isCalling ? (
          <div className="flex items-center gap-2.5 px-3 py-1 rounded bg-[#091510] border border-amadeus-accent/40">
            <span className="w-2 h-2 rounded-full bg-amadeus-accent animate-ping" />
            <span className="text-xs font-mono text-amadeus-accent tracking-widest font-semibold">
              CONNECTED: {personaName.toUpperCase()}
            </span>
            <span className="text-xs font-mono text-[#a0c5b5] font-bold ml-1">
              [{formatTimer(elapsedSeconds)}]
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-amadeus-card border border-amadeus-border">
            <span className="w-2 h-2 rounded-full bg-amadeus-amber" />
            <span className="text-xs font-mono text-amadeus-amber tracking-widest">
              STANDBY // LAB READY
            </span>
          </div>
        )}

        {isCalling && onNewCall && (
          <button
            onClick={onNewCall}
            title="Arquiva a conversa atual e inicia uma nova chamada com a Kurisu"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-amadeus-border bg-amadeus-card text-[11px] text-amadeus-muted hover:text-white hover:border-amadeus-accent transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-amadeus-accent" />
            <span>Nova Chamada</span>
          </button>
        )}
      </div>

      {/* Right: Storage Engine, AI Indicator & Signal */}
      <div className="flex items-center gap-3 text-xs font-mono">
        {/* ChromaDB + SQLite indicator */}
        <div className="hidden lg:flex items-center">
          {backendHealth ? (
            <span
              title={`Armazenamento Python ativo: ChromaDB (${backendHealth.chromaCount} vetores) e SQLite (${backendHealth.totalSessions} sessões)`}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-amadeus-accent/40 bg-amadeus-card text-[10px] text-amadeus-accent"
            >
              <Database className="w-3 h-3" />
              <span>CHROMA + SQLITE</span>
            </span>
          ) : (
            <span
              title="Armazenamento local no navegador (LocalStorage)"
              className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-amadeus-border bg-amadeus-card text-[10px] text-amadeus-muted"
            >
              <Database className="w-3 h-3" />
              <span>LOCAL BROWSER</span>
            </span>
          )}
        </div>

        {/* AI Engine Model badge */}
        <div className="hidden sm:flex items-center gap-1.5">
          {(() => {
            const badge = {
              online: { color: 'text-amadeus-accent border-amadeus-accent/50', dot: 'bg-amadeus-accent', label: `IA: ${aiStatus.kind === 'online' ? aiStatus.model.toUpperCase() : ''}` },
              pending: { color: 'text-amadeus-cyan border-amadeus-cyan/40', dot: 'bg-amadeus-cyan animate-pulse', label: 'IA: AGUARDANDO RESPOSTA' },
              error: { color: 'text-amadeus-red border-amadeus-red/60', dot: 'bg-amadeus-red animate-pulse', label: 'ERRO NA IA' },
              offline: { color: 'text-amadeus-amber border-amadeus-amber/40', dot: 'bg-amadeus-amber', label: 'SIMULADOR OFFLINE' },
            }[aiStatus.kind];
            return (
              <span
                title={aiStatus.kind === 'error' ? aiStatus.message : undefined}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border bg-amadeus-card text-[11px] ${badge.color}`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                <span>{badge.label}</span>
              </span>
            );
          })()}
        </div>

        <div className="flex items-center gap-1.5 text-amadeus-accent">
          <Wifi className="w-3.5 h-3.5" />
          <span className="text-[11px] tracking-wider">98.4%</span>
        </div>

        <div className="flex items-center gap-1 text-[#4ade80]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden md:inline">SECURE</span>
        </div>
      </div>
    </header>
  );
};
