import React, { useState, useEffect } from 'react';
import { BackendService } from '../services/backendService';

export const DivergenceMeter: React.FC = () => {
  const [divergence, setDivergence] = useState<string>('1.048596');
  const [worldline, setWorldline] = useState<string>('Steins Gate');
  const [isHovered, setIsHovered] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDiv = async () => {
      try {
        const data = await BackendService.getDivergence();
        if (isMounted) {
          setDivergence(data.divergence || '1.048596');
          setWorldline(data.worldline || 'Steins Gate');
        }
      } catch {
        // keep fallback
      }
    };

    fetchDiv();
    const interval = setInterval(fetchDiv, 60000); // refresh every minute
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Format characters for Nixie tube look
  const cleanDigits = divergence.replace(/[^0-9.]/g, '');
  const displayChars = cleanDigits.split('');

  return (
    <div
      className="relative hidden sm:flex items-center gap-1.5 bg-[#100a06] border border-[#d97706] px-2.5 py-1 rounded box-glow-nixie cursor-help select-none group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Medidor de Divergência: ${divergence}% [${worldline}]`}
    >
      <span className="text-[10px] font-mono text-[#d97706] font-bold">DIV:</span>
      <div className="flex items-center gap-0.5 font-mono text-xs font-bold tracking-widest text-[#fbbf24] text-glow-nixie">
        {displayChars.map((char, idx) => (
          <span
            key={idx}
            className={`inline-block text-center ${
              char === '.'
                ? 'w-1 text-[#f59e0b] -mx-0.5'
                : 'w-2.5 px-0.5 py-0.2 bg-[#261004] rounded-[2px] border border-[#d97706]/40 shadow-[0_0_4px_rgba(245,158,11,0.4)]'
            }`}
          >
            {char}
          </span>
        ))}
        <span className="text-[10px] text-[#f59e0b] ml-0.5">%</span>
      </div>

      {/* Floating tooltip on hover */}
      {isHovered && (
        <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-50 bg-[#120a04] border border-[#f59e0b]/50 text-[#fbbf24] text-[10px] font-mono px-2.5 py-1 rounded shadow-xl whitespace-nowrap pointer-events-none">
          <div className="font-bold text-[#f59e0b]">MEDIDOR DE DIVERGÊNCIA</div>
          <div className="text-[9px] text-[#cbd5e1]">{worldline}</div>
        </div>
      )}
    </div>
  );
};
