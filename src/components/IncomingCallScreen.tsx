import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { PersonaProfile } from '../types/amadeus';
import { KURISU_AVATAR_DEFAULT } from '../services/spriteCatalog';
import { LabBackground } from './LabBackground';

interface IncomingCallScreenProps {
  persona: PersonaProfile;
  onAccept: () => void;
  onDecline: () => void;
  scanlines?: boolean;
}

export const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({
  persona,
  onAccept,
  onDecline,
  scanlines = true,
}) => {
  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-between p-6 bg-[#0c0e12] overflow-hidden select-none font-mono">
      <LabBackground scanlines={scanlines} />

      {/* Top Banner */}
      <div className="z-10 text-center space-y-1 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161922] border border-[#f59e0b]/40 text-[#f59e0b] text-xs box-glow-nixie">
          <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-ping" />
          <span>TRANSMISSÃO RECEBIDA // AMADEUS OS</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-[#f8fafc] tracking-widest text-glow-nixie pt-2">
          VIKTOR CHONDRIA UNIVERSITY
        </h1>
        <p className="text-xs text-[#717d96]">
          LABORATÓRIO DE NEUROCIÊNCIA COMPUTACIONAL
        </p>
      </div>

      {/* Center Radar / Caller Profile */}
      <div className="z-10 flex flex-col items-center justify-center space-y-6">
        {/* Pulsing Amber Radar Rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-48 h-48 md:w-60 md:h-60 rounded-full border border-[#f59e0b]/20 animate-ping" />
          <div className="absolute w-40 h-40 md:w-52 md:h-52 rounded-full border border-[#f59e0b]/30 animate-pulse" />
          
          {/* Avatar Ring */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-[#f59e0b] p-1 shadow-[0_0_35px_rgba(245,158,11,0.4)] bg-[#161922] flex items-center justify-center overflow-hidden">
            <img
              src={KURISU_AVATAR_DEFAULT}
              alt="Makise Kurisu"
              className="w-full h-full object-cover object-top scale-150 translate-y-3"
            />
          </div>
        </div>

        {/* Identity Information */}
        <div className="text-center space-y-1">
          <div className="text-lg md:text-xl font-bold text-[#f8fafc] tracking-wide text-glow-nixie">
            {persona.name}
          </div>
          <div className="text-xs text-[#f59e0b] font-semibold tracking-wider">
            [{persona.codeName.toUpperCase()}]
          </div>
          <div className="text-[11px] text-[#717d96] max-w-sm px-4 font-sans">
            {persona.title} • {persona.affiliation}
          </div>
        </div>
      </div>

      {/* Bottom Call Action Buttons */}
      <div className="z-10 w-full max-w-sm flex items-center justify-around pb-10">
        {/* Decline Button */}
        <button
          onClick={onDecline}
          className="flex flex-col items-center gap-2 group transition-transform active:scale-95"
        >
          <div className="w-16 h-16 rounded-full bg-[#ef4444]/20 border-2 border-[#ef4444] flex items-center justify-center text-[#ef4444] group-hover:bg-[#ef4444] group-hover:text-white transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <PhoneOff className="w-7 h-7" />
          </div>
          <span className="text-xs text-[#717d96] group-hover:text-[#ef4444] tracking-wider font-semibold">
            IGNORAR
          </span>
        </button>

        {/* Accept Button */}
        <button
          onClick={onAccept}
          className="flex flex-col items-center gap-2 group transition-transform active:scale-95"
        >
          <div className="w-16 h-16 rounded-full bg-[#f59e0b]/25 border-2 border-[#f59e0b] flex items-center justify-center text-[#fbbf24] group-hover:bg-[#f59e0b] group-hover:text-black transition-all shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-bounce">
            <Phone className="w-7 h-7" />
          </div>
          <span className="text-xs text-[#fbbf24] group-hover:text-white tracking-wider font-bold">
            CONECTAR
          </span>
        </button>
      </div>
    </div>
  );
};
