import React, { useState } from 'react';
import { MemoryItem, PersonaProfile } from '../types/amadeus';
import { MemoryService } from '../services/memoryService';
import { Database, Plus, X, Brain, Tag, Sparkles } from 'lucide-react';

interface MemoryInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: PersonaProfile;
  recalledMemoryIds?: string[];
  onMemoryAdded?: () => void;
}

export const MemoryInspectorModal: React.FC<MemoryInspectorModalProps> = ({
  isOpen,
  onClose,
  persona,
  recalledMemoryIds = [],
  onMemoryAdded,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryItem['category']>('anecdote');
  const [newEmotion, setNewEmotion] = useState('');

  if (!isOpen) return null;

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const keywords = newKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    MemoryService.addMemory(persona.id, {
      title: newTitle.trim(),
      category: newCategory,
      triggerKeywords: keywords,
      content: newContent.trim(),
      emotionalWeight: newEmotion.trim() || 'Neutro / Factual',
    });

    setNewTitle('');
    setNewKeywords('');
    setNewContent('');
    setNewEmotion('');
    setShowAddForm(false);
    onMemoryAdded?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl bg-amadeus-panel border border-amadeus-border shadow-[0_0_40px_rgba(0,0,0,0.9)] overflow-hidden font-mono text-sm">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amadeus-border bg-amadeus-card">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-amadeus-border/40 flex items-center justify-center text-amadeus-accent">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amadeus-accent tracking-wider text-glow-green">
                INSPETOR DE CÓRTEX & MEMÓRIAS // {persona.name.toUpperCase()}
              </h2>
              <div className="text-[11px] text-amadeus-muted">
                {persona.memories.length} BLOCOS DE MEMÓRIA DIGITALIZADOS
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-amadeus-muted hover:text-white hover:bg-amadeus-border/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add Memory Button / Toggle */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-amadeus-muted">
              Memórias ativas e histórico sináptico:
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded bg-amadeus-border/40 border border-amadeus-accent/40 text-amadeus-accent text-xs flex items-center gap-1.5 hover:bg-amadeus-accent hover:text-black transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancelar' : 'Digitalizar Nova Memória'}</span>
            </button>
          </div>

          {/* New Memory Form */}
          {showAddForm && (
            <form onSubmit={handleAddMemory} className="p-4 rounded-lg bg-amadeus-card border border-amadeus-accent/40 space-y-3 animate-fadeIn">
              <div className="text-xs font-bold text-amadeus-accent flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>INJETAR NOVO BLOCO SINÁPTICO</span>
              </div>
              <div>
                <label className="text-[11px] text-amadeus-muted block mb-1">Título da Memória:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Conversa sobre o futuro no terraço"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full h-8 px-3 rounded bg-amadeus-panel border border-amadeus-border text-xs text-white focus:outline-none focus:border-amadeus-accent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-amadeus-muted block mb-1">Categoria:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full h-8 px-2 rounded bg-amadeus-panel border border-amadeus-border text-xs text-white focus:outline-none focus:border-amadeus-accent"
                  >
                    <option value="anecdote">História Pessoal / Episódio</option>
                    <option value="research">Pesquisa / Teoria Científica</option>
                    <option value="relationship">Relação Interpessoal</option>
                    <option value="secret">Segredo / Fato Oculto</option>
                    <option value="biography">Biografia / Fato de Vida</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-amadeus-muted block mb-1">Sentimento / Peso Emocional:</label>
                  <input
                    type="text"
                    placeholder="Ex: Nostalgia e carinho"
                    value={newEmotion}
                    onChange={(e) => setNewEmotion(e.target.value)}
                    className="w-full h-8 px-3 rounded bg-amadeus-panel border border-amadeus-border text-xs text-white focus:outline-none focus:border-amadeus-accent"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-amadeus-muted block mb-1">Palavras-chave de ativação (separadas por vírgula):</label>
                <input
                  type="text"
                  placeholder="Ex: terraço, noite, estrelas, futuro, promessa"
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  className="w-full h-8 px-3 rounded bg-amadeus-panel border border-amadeus-border text-xs text-white focus:outline-none focus:border-amadeus-accent"
                />
              </div>
              <div>
                <label className="text-[11px] text-amadeus-muted block mb-1">Conteúdo da Memória (como ela se lembra):</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva a memória na primeira pessoa ou como fato marcante..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full p-2.5 rounded bg-amadeus-panel border border-amadeus-border text-xs text-white focus:outline-none focus:border-amadeus-accent font-sans"
                />
              </div>
              <button
                type="submit"
                className="w-full h-8 rounded bg-amadeus-accent text-black font-bold text-xs hover:bg-[#00e676] transition-colors"
              >
                SALVAR E CONVERTER EM SINAPSE
              </button>
            </form>
          )}

          {/* Memory List */}
          <div className="space-y-3">
            {persona.memories.map((mem) => {
              const isTriggered = recalledMemoryIds.includes(mem.id);
              return (
                <div
                  key={mem.id}
                  className={`p-3.5 rounded-lg border transition-all ${
                    isTriggered
                      ? 'bg-amadeus-accent/10 border-amadeus-accent shadow-[0_0_15px_rgba(0,255,136,0.15)]'
                      : 'bg-amadeus-card border-amadeus-border/60 hover:border-amadeus-border'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-amadeus-border/30 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isTriggered ? 'bg-amadeus-accent animate-ping' : 'bg-amadeus-border'}`} />
                      <span className="font-bold text-xs text-[#e2f5ec]">
                        {mem.title}
                      </span>
                      {isTriggered && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amadeus-accent text-black font-bold">
                          ATIVADA NO CÓRTEX
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-amadeus-muted uppercase">
                      CAT: {mem.category}
                    </span>
                  </div>

                  <p className="text-xs text-[#b8d6c8] font-sans leading-relaxed mb-2">
                    {mem.content}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-amadeus-muted pt-1 border-t border-amadeus-border/20">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag className="w-3 h-3 text-amadeus-accent" />
                      {mem.triggerKeywords.map((kw, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-amadeus-panel border border-amadeus-border/40 text-amadeus-accent">
                          #{kw}
                        </span>
                      ))}
                    </div>
                    {mem.emotionalWeight && (
                      <span className="text-[#a5c5b5] italic">
                        Sentimento: {mem.emotionalWeight}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-amadeus-border bg-amadeus-card flex items-center justify-between text-xs text-amadeus-muted">
          <span>AMADEUS NEURAL STORAGE // LOCALHOST ENCRYPTED</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-amadeus-border/60 hover:bg-amadeus-border text-white text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
