import React, { useState, useEffect } from 'react';
import { Emotion } from '../types/amadeus';
import { Sparkles } from 'lucide-react';

interface SubtitleBoxProps {
  speakerName: string;
  text: string;
  emotion: Emotion;
  isProcessing: boolean;
  onTopicClick?: (topic: string) => void;
}

const EMOTION_LABELS: Record<Emotion, { label: string; color: string }> = {
  // Canonical 12
  neutral: { label: 'Neutra / Focada', color: 'text-amadeus-muted border-amadeus-border' },
  wink: { label: 'Piscadela / Descontraída', color: 'text-[#86efac] border-[#22c55e]/40' },
  annoyed: { label: 'Irritada / Aborrecida', color: 'text-amadeus-amber border-amadeus-amber/40' },
  worried: { label: 'Preocupada / Aflita', color: 'text-[#f472b6] border-[#ec4899]/40' },
  disdain: { label: 'Desdém / Cética', color: 'text-amadeus-muted border-amadeus-border/60' },
  happy: { label: 'Feliz / Satisfeita', color: 'text-amadeus-accent border-amadeus-accent/50' },
  stern: { label: 'Severa / Rígida', color: 'text-amadeus-red border-amadeus-red/50' },
  blushing: { label: 'Envergonhada / Corada', color: 'text-[#fb7185] border-[#f43f5e]/40' },
  look_side: { label: 'Olhar de Soslaio / Tímida', color: 'text-[#a78bfa] border-[#8b5cf6]/40' },
  eyes_closed: { label: 'Olhos Fechados / Repouso', color: 'text-amadeus-muted border-amadeus-border/40' },
  analytical: { label: 'Analítica / Foco Científico', color: 'text-amadeus-cyan border-amadeus-cyan/40' },
  holding_back_tears: { label: 'Emocionada / Quase Chorando', color: 'text-[#93c5fd] border-[#3b82f6]/40' },

  // Legacy & Poses
  smile: { label: 'Sorriso / Gentil', color: 'text-[#86efac] border-[#22c55e]/40' },
  serious: { label: 'Analítica / Foco Científico', color: 'text-amadeus-cyan border-amadeus-cyan/40' },
  surprised: { label: 'Surpresa / Chocada', color: 'text-[#f472b6] border-[#ec4899]/40' },
  tsundere: { label: 'Tsundere / Defensiva', color: 'text-amadeus-red border-amadeus-red/50' },
  thinking: { label: 'Pensativa / Braços Cruzados', color: 'text-[#38bdf8] border-[#0ea5e9]/40' },
  smug: { label: 'Confiante / Debochada', color: 'text-[#facc15] border-[#eab308]/40' },
  flustered: { label: 'Envergonhada / Corada', color: 'text-[#fb7185] border-[#f43f5e]/40' },
  sad: { label: 'Melancólica / Magoada', color: 'text-[#93c5fd] border-[#3b82f6]/40' },
  puzzled: { label: 'Intrigada / Investigativa', color: 'text-[#c084fc] border-[#a855f7]/40' },
  desperate: { label: 'Aflita / Desesperada', color: 'text-[#f87171] border-[#ef4444]/50' },
};

const SUGGESTED_TOPICS = [
  'Quem é você?',
  'O que acha sobre viagem no tempo?',
  'Olá Christina!',
  'Você acessa o @channel?',
  'Como é sua pesquisa na Viktor Chondria?',
  'Qual sua opinião sobre Dr Pepper?',
];

export const SubtitleBox: React.FC<SubtitleBoxProps> = ({
  speakerName,
  text,
  emotion,
  isProcessing,
  onTopicClick,
}) => {
  const [displayedText, setDisplayedText] = useState('');

  // Smooth typewriter effect
  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      return;
    }

    let currentIndex = 0;
    setDisplayedText('');

    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 18);

    return () => clearInterval(interval);
  }, [text]);

  const emotionInfo = EMOTION_LABELS[emotion] || EMOTION_LABELS.neutral;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-2">
      {/* Quick Suggestions Chips */}
      {onTopicClick && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono scrollbar-none">
          <span className="text-amadeus-muted flex items-center gap-1 text-[11px] shrink-0 mr-1">
            <Sparkles className="w-3 h-3 text-amadeus-accent" />
            <span>TÓPICOS:</span>
          </span>
          {SUGGESTED_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => onTopicClick(topic)}
              className="px-2.5 py-1 rounded-full bg-amadeus-panel border border-amadeus-border text-amadeus-muted hover:text-amadeus-accent hover:border-amadeus-accent/60 transition-colors text-[11px] whitespace-nowrap"
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      {/* Main Dialogue Box */}
      <div className="relative border border-amadeus-border/80 bg-amadeus-panel/95 backdrop-blur-md rounded-lg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {/* Header: Name and Mood Badge */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-amadeus-border/40">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-amadeus-accent tracking-wider text-glow-green">
              [ {speakerName} ]
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amadeus-card text-[#8fb5a2]">
              AMADEUS UNIT
            </span>
          </div>

          <div className={`text-[10px] font-mono px-2 py-0.5 rounded border bg-amadeus-card ${emotionInfo.color}`}>
            MOOD: {emotionInfo.label.toUpperCase()}
          </div>
        </div>

        {/* Content Body */}
        <div className="min-h-[56px] text-sm md:text-base leading-relaxed text-[#dcfce7] font-sans">
          {isProcessing ? (
            <div className="flex items-center gap-2 text-amadeus-accent font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-amadeus-accent animate-ping" />
              <span>Acessando registros sinápticos e formulando resposta...</span>
            </div>
          ) : (
            <p className="tracking-wide">
              {displayedText}
              {displayedText.length < text.length && (
                <span className="inline-block w-2 h-4 bg-amadeus-accent ml-1 animate-pulse" />
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
