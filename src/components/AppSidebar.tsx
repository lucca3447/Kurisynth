import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Trash2, 
  Brain, 
  Settings, 
  ChevronLeft,
  Database
} from 'lucide-react';
import { CallSession } from '../types/amadeus';
import { BackendHealth } from '../services/backendService';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: CallSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  backendHealth?: BackendHealth | null;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenMemory,
  onOpenSettings,
  backendHealth,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.summary || '').toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  };

  if (!isOpen) return null;

  return (
    <aside className="w-72 border-r border-[#222836] bg-[#12151c]/95 backdrop-blur-md flex flex-col justify-between shrink-0 font-mono text-xs select-none z-20 transition-all duration-300">
      {/* Top Header & Actions */}
      <div className="p-3 border-b border-[#202532] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span className="font-bold text-[#f59e0b] tracking-wider text-glow-nixie">
              HISTÓRICO DO LAB
            </span>
          </div>
          <button
            onClick={onClose}
            title="Recolher Barra Lateral"
            className="p-1 rounded text-[#717d96] hover:text-white hover:bg-[#1a1e28] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Session Button */}
        <button
          onClick={onNewSession}
          className="w-full py-2.5 px-3 rounded-lg bg-[#f59e0b]/15 hover:bg-[#f59e0b] hover:text-black border border-[#f59e0b]/50 text-[#fbbf24] font-bold text-xs flex items-center justify-center gap-2 transition-all box-glow-nixie"
        >
          <Plus className="w-4 h-4" />
          <span>NOVA CONVERSA</span>
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#717d96] absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversas..."
            className="w-full bg-[#161a22] border border-[#272d3c] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#cbd5e1] placeholder-[#64748b] focus:outline-none focus:border-[#f59e0b] transition-colors font-sans"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredSessions.length === 0 ? (
          <div className="py-10 text-center text-[#64748b] text-[11px] space-y-1">
            <p>Nenhuma sessão anterior</p>
            <p className="text-[10px] text-[#475569]">Suas conversas salvas aparecerão aqui.</p>
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  isActive
                    ? 'bg-[#1e2330] border-[#f59e0b]/50 text-[#f8fafc] shadow-sm'
                    : 'bg-[#141720]/70 border-transparent text-[#94a3b8] hover:bg-[#1a1e28] hover:text-white hover:border-[#272d3c]'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden pr-1">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#f59e0b]' : 'text-[#64748b]'}`} />
                  <div className="overflow-hidden">
                    <p className="truncate text-xs font-sans font-medium">
                      {session.summary || 'Conversa com Kurisu'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[#64748b] mt-0.5 font-mono">
                      <span>{formatDate(session.startedAt)}</span>
                      <span>•</span>
                      <span>{session.messageCount} msg</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Deseja excluir esta conversa do histórico?')) {
                      onDeleteSession(session.id);
                    }
                  }}
                  title="Excluir Conversa"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#ef4444]/20 hover:text-[#ef4444] transition-all text-[#64748b]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Footer Shortcuts */}
      <div className="p-3 border-t border-[#202532] space-y-1.5 bg-[#0e1017]">
        <button
          onClick={onOpenMemory}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#94a3b8] hover:text-[#38bdf8] hover:bg-[#161a22] transition-colors"
        >
          <Brain className="w-4 h-4 text-[#38bdf8]" />
          <span>Córtex & Memórias</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#94a3b8] hover:text-[#f59e0b] hover:bg-[#161a22] transition-colors"
        >
          <Settings className="w-4 h-4 text-[#f59e0b]" />
          <span>Configurações</span>
        </button>

        <div className="pt-1.5 border-t border-[#1a1e28] flex items-center justify-between text-[10px] text-[#64748b] px-1 font-mono">
          <span className="flex items-center gap-1">
            <Database className="w-3 h-3 text-[#f59e0b]" />
            <span>{backendHealth ? 'CHROMA + SQLITE' : 'LOCAL STORAGE'}</span>
          </span>
          <span className="text-[#475569]">OPENAMADEUS</span>
        </div>
      </div>
    </aside>
  );
};
