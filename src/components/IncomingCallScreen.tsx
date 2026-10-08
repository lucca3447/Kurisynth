import React from 'react';
import { Phone, PhoneOff, Cpu, ShieldCheck } from 'lucide-react';
import { PersonaProfile } from '../types/amadeus';
import { KURISU_AVATAR_DEFAULT } from '../services/spriteCatalog';

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
    <div className="relative w-full h-screen flex flex-col items-center justify-between p-6 bg-[#050907] overflow-hidden select-none font-mono">
      {/* Sci-fi Background Grid */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle, #00ff88 1px, transparent 1px),
            linear-gradient(to right, rgba(0, 255, 136, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 255, 136, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 80px 80px, 80px 80px'
        }}
      />

      {/* Top Banner */}
      <div className="z-10 text-center space-y-1 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amadeus-panel border border-amadeus-accent/40 text-amadeus-accent text-xs">
          <span className="w-2 h-2 rounded-full bg-amadeus-accent animate-ping" />
          <span>INCOMING TRANSMISSION // AMADEUS OS</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-widest text-glow-green pt-2">
          VIKTOR CHONDRIA UNIVERSITY
        </h1>
        <p className="text-xs text-amadeus-muted">
          NEUROSCIENCE RESEARCH LABORATORY #304
        </p>
      </div>

      {/* Center Radar / Caller Profile */}
      <div className="z-10 flex flex-col items-center justify-center space-y-6">
        {/* Pulsing Radar Ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-48 h-48 md:w-60 md:h-60 rounded-full border border-amadeus-accent/20 animate-ping" />
          <div className="absolute w-40 h-40 md:w-52 md:h-52 rounded-full border border-amadeus-accent/30 animate-pulse" />
          
          {/* Avatar Ring */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-amadeus-accent p-1 shadow-[0_0_30px_rgba(0,255,136,0.3)] bg-amadeus-card flex items-center justify-center overflow-hidden">
            <img
              src={KURISU_AVATAR_DEFAULT}
              alt="Makise Kurisu"
              className="w-full h-full object-cover object-top scale-150 translate-y-3"
            />
          </div>
        </div>

        {/* Identity Information */}
        <div className="text-center space-y-1">
          <div className="text-lg md:text-xl font-bold text-white tracking-wide">
            {persona.name}
          </div>
          <div className="text-xs text-amadeus-accent font-semibold tracking-wider">
            [{persona.codeName.toUpperCase()}]
          </div>
          <div className="text-[11px] text-amadeus-muted max-w-sm px-4">
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
          <div className="w-16 h-16 rounded-full bg-amadeus-red/20 border-2 border-amadeus-red flex items-center justify-center text-amadeus-red group-hover:bg-amadeus-red group-hover:text-white transition-all shadow-[0_0_20px_rgba(255,51,75,0.3)]">
            <PhoneOff className="w-7 h-7" />
          </div>
          <span className="text-xs text-amadeus-muted group-hover:text-amadeus-red tracking-wider font-semibold">
            IGNORAR
          </span>
        </button>

        {/* Accept Button */}
        <button
          onClick={onAccept}
          className="flex flex-col items-center gap-2 group transition-transform active:scale-95"
        >
          <div className="w-16 h-16 rounded-full bg-[#00ff88]/20 border-2 border-amadeus-accent flex items-center justify-center text-amadeus-accent group-hover:bg-amadeus-accent group-hover:text-black transition-all shadow-[0_0_25px_rgba(0,255,136,0.4)] animate-bounce">
            <Phone className="w-7 h-7" />
          </div>
          <span className="text-xs text-amadeus-accent group-hover:text-white tracking-wider font-bold">
            CONECTAR
          </span>
        </button>
      </div>

      {/* Scanline Overlay */}
      {scanlines && (
        <div className="absolute inset-0 crt-scanlines pointer-events-none z-20" />
      )}
    </div>
  );
};
