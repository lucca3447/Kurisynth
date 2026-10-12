import React, { useState, useEffect, useRef } from 'react';
import { CharacterPose, Emotion, MouthState } from '../types/amadeus';
import { preloadPrimarySprites, resolveKurisuSprite } from '../services/spriteCatalog';
import { SpeechService } from '../services/speechService';

interface AmadeusSpriteViewProps {
  emotion: Emotion;
  pose?: CharacterPose;
  isSpeaking: boolean;
  scanlines?: boolean;
  className?: string;
}

export const AmadeusSpriteView: React.FC<AmadeusSpriteViewProps> = ({
  emotion,
  pose = 'default',
  isSpeaking,
  scanlines = false,
  className = '',
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
  const activeBlinking = isBlinking && !isSpeaking;
  const currentFrameUrl = resolveKurisuSprite(emotion, mouthState, activeBlinking, pose);

  return (
    <div className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none ${className}`}>
      {/* Character Sprite Container */}
      <div className="relative z-10 w-full h-full flex items-end justify-center pointer-events-none pb-2">
        <div className="relative max-h-[95%] flex items-end justify-center transition-transform duration-700 ease-in-out">
          <img
            src={currentFrameUrl}
            alt="Amadeus Makise Kurisu"
            className="max-h-[78vh] w-auto object-contain filter drop-shadow-[0_0_30px_rgba(245,158,11,0.22)] transition-opacity duration-150"
            draggable={false}
          />
        </div>
      </div>

      {/* Local Scanline Overlay if enabled specifically */}
      {scanlines && (
        <div className="absolute inset-0 crt-scanlines pointer-events-none z-20" />
      )}

      {/* Subtle Depth Vignette */}
      <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_90px_rgba(0,0,0,0.85)]" />
    </div>
  );
};
