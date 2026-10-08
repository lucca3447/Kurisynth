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
      className="relative flex items-center gap-1 bg-[#100804] border border-[#ff6600]/40 px-2.5 py-1 rounded shadow-[inset_0_0_8px_rgba(255,102,0,0.2)] cursor-help select-none group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Divergence Meter: ${divergence}% [${worldline}]`}
    >
      <div className="flex items-center gap-0.5 font-mono text-xs font-bold tracking-widest text-[#ff8800] drop-shadow-[0_0_6px_rgba(255,136,0,0.9)]">
        {displayChars.map((char, idx) => (
          <span
            key={idx}
            className={`inline-block text-center ${
              char === '.'
                ? 'w-1 text-[#ffaa33] -mx-0.5'
                : 'w-2.5 px-0.5 py-0.2 bg-[#220d04]/80 rounded-[2px] border border-[#ff5500]/30 shadow-[0_0_4px_rgba(255,85,0,0.4)]'
            }`}
          >
            {char}
          </span>
        ))}
        <span className="text-[10px] text-[#ff7700]/80 ml-0.5">%</span>
      </div>

      {/* Floating tooltip on hover */}
      {isHovered && (
        <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-50 bg-[#0d0705] border border-[#ff6600]/50 text-[#ffaa66] text-[10px] font-mono px-2 py-1 rounded shadow-xl whitespace-nowrap pointer-events-none">
          <div className="font-bold text-[#ff9933]">DIVERGENCE METER</div>
          <div className="text-[9px] text-[#cca080]">{worldline}</div>
        </div>
      )}
    </div>
  );
};
