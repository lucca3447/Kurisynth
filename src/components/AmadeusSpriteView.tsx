import React, { useState, useEffect, useRef } from 'react';
import { CharacterPose, Emotion, MouthState } from '../types/amadeus';
import { preloadPrimarySprites, resolveKurisuSprite } from '../services/spriteCatalog';
import { SpeechService } from '../services/speechService';

interface AmadeusSpriteViewProps {
  emotion: Emotion;
  pose?: CharacterPose;
  isSpeaking: boolean;
  scanlines?: boolean;
}

export const AmadeusSpriteView: React.FC<AmadeusSpriteViewProps> = ({
  emotion,
  pose = 'default',
  isSpeaking,
  scanlines = true,
}) => {
  const [mouthState, setMouthState] = useState<MouthState>('closed');
  const [isBlinking, setIsBlinking] = useState(false);
  const lipFlapIntervalRef = useRef<number | null>(null);

  // Preload sprites on initial mount
  useEffect(() => {
    preloadPrimarySprites();
  }, []);

  // Autonomous Blinking Cycle (Every 3.5 to 6 seconds when not speaking)
  useEffect(() => {
    let blinkTimeout: number;
    let blinkEndTimeout: number;

    const scheduleNextBlink = () => {
      const delay = Math.floor(Math.random() * 2500) + 3500; // 3.5s - 6s
      blinkTimeout = window.setTimeout(() => {
        // Only blink if not speaking
        setIsBlinking(true);
        blinkEndTimeout = window.setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 130); // Authentic blink duration: 130ms
      }, delay);
    };

    scheduleNextBlink();

    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(blinkEndTimeout);
    };
  }, []);

  // Acoustic & Syllable 3-Stage Lip-Sync (closed -> half -> open)
  useEffect(() => {
    if (!isSpeaking) {
      if (lipFlapIntervalRef.current) {
        clearInterval(lipFlapIntervalRef.current);
        lipFlapIntervalRef.current = null;
      }
      setMouthState('closed');
      return;
    }

    // High-fidelity audio listener for amplitude and syllable triggers
    const unsubscribe = SpeechService.addLipSyncListener((isOpen, amplitude) => {
      if (!isSpeaking) {
        setMouthState('closed');
        return;
      }

      if (!isOpen) {
        setMouthState('closed');
      } else if (amplitude > 0.45) {
        // High acoustic energy or tonic syllable: mouth open (02)
        setMouthState('open');
      } else {
        // Medium acoustic energy or transition: mouth half (01)
        setMouthState('half');
      }
    });

    // Fluid secondary lip-flap animator for smooth cadence during speech
    let flapStep = 0;
    lipFlapIntervalRef.current = window.setInterval(() => {
      if (!isSpeaking) return;
      flapStep = (flapStep + 1) % 4;
      // Cycle: closed (00) -> half (01) -> open (02) -> half (01)
      const states: MouthState[] = ['closed', 'half', 'open', 'half'];
      setMouthState(states[flapStep]);
    }, 120);

    return () => {
      unsubscribe();
      if (lipFlapIntervalRef.current) {
        clearInterval(lipFlapIntervalRef.current);
        lipFlapIntervalRef.current = null;
      }
      setMouthState('closed');
    };
  }, [isSpeaking]);

  // Determine current image frame based on canonical matrix, pose, speech, and blink
  // Active blink is suppressed while speaking to preserve lip-sync stability
  const activeBlinking = isBlinking && !isSpeaking;
  const currentFrameUrl = resolveKurisuSprite(emotion, mouthState, activeBlinking, pose);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#060a08] via-[#09110d] to-[#040806]">
      {/* Sci-fi Background Grid & Vignette */}
      <div 
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `
            radial-gradient(circle, #00ff88 1px, transparent 1px),
            linear-gradient(to right, rgba(0, 255, 136, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 255, 136, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px, 60px 60px, 60px 60px'
        }}
      />

      {/* Target Crosshairs / Scientific Reticle */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amadeus-accent/40" />
      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amadeus-accent/40" />
      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amadeus-accent/40" />
      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amadeus-accent/40" />

      {/* Video Connection Metadata */}
      <div className="absolute top-4 left-12 text-[11px] font-mono text-amadeus-muted tracking-widest flex items-center gap-2">
        <span className="text-amadeus-accent">FEED // LAB_304_CAM_01</span>
        <span className="opacity-50">|</span>
        <span>RESOLUTION: 1080P_RAW</span>
      </div>

      <div className="absolute top-4 right-12 text-[11px] font-mono text-amadeus-accent/80 tracking-wider flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amadeus-accent animate-pulse" />
        <span>FPS: 60.0</span>
      </div>

      {/* Character Sprite Container */}
      <div className="relative z-10 w-full h-full flex items-end justify-center select-none pointer-events-none pb-2">
        {/* Subtle breathing animation applied to avatar wrapper */}
        <div className="relative max-h-[92%] flex items-end justify-center transition-transform duration-700 ease-in-out">
          <img
            src={currentFrameUrl}
            alt="Amadeus Makise Kurisu"
            className="max-h-[82vh] w-auto object-contain filter drop-shadow-[0_0_25px_rgba(0,255,136,0.15)] transition-opacity duration-150"
            draggable={false}
          />
        </div>
      </div>

      {/* CRT Scanline Overlay (Toggleable) */}
      {scanlines && (
        <div className="absolute inset-0 crt-scanlines pointer-events-none z-20" />
      )}

      {/* Subtle CRT Phosphor Glow Vignette */}
      <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_80px_rgba(0,0,0,0.85)]" />
    </div>
  );
};
