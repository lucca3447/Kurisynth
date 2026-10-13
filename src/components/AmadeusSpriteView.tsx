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
    let lastAcousticTimestamp = 0;

    const unsubscribe = SpeechService.addLipSyncListener((isOpen, amplitude) => {
      if (!isSpeaking) {
        setMouthState('closed');
        return;
      }
      lastAcousticTimestamp = Date.now();

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

    // Secondary fallback lip-flap animator when no acoustic stream is active (e.g. browser TTS fallback)
    let flapStep = 0;
    lipFlapIntervalRef.current = window.setInterval(() => {
      if (!isSpeaking) return;
      if (Date.now() - lastAcousticTimestamp > 300) {
        flapStep = (flapStep + 1) % 4;
        // Cycle: closed (00) -> half (01) -> open (02) -> half (01)
        const states: MouthState[] = ['closed', 'half', 'open', 'half'];
        setMouthState(states[flapStep]);
      }
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

  const [imageError, setImageError] = useState(false);

  // Determine current image frame based on canonical matrix, pose, speech, and blink
  const activeBlinking = isBlinking && !isSpeaking;
  const currentFrameUrl = resolveKurisuSprite(emotion, mouthState, activeBlinking, pose);

  useEffect(() => {
    // Reset error state if frame URL changes to re-attempt loading
    setImageError(false);
  }, [currentFrameUrl]);

  return (
    <div className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none ${className}`}>
      {/* Character Sprite Container */}
      <div className="relative z-10 w-full h-full flex items-end justify-center pointer-events-none pt-4 pb-1">
        {!imageError ? (
          <div className="relative h-full max-h-full flex items-end justify-center transition-transform duration-700 ease-in-out">
            <img
              src={currentFrameUrl}
              alt="OpenAmadeus Companion Sprite"
              className="h-full max-h-full w-auto object-contain object-bottom filter drop-shadow-[0_0_30px_rgba(245,158,11,0.22)] transition-opacity duration-150"
              draggable={false}
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />
          </div>
        ) : (
          /* Holographic Silhouette Fallback (Zero Copyright / Modular Avatar Mode) */
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
            <div className="relative flex items-center justify-center mb-4">
              {/* Audio Pulse Ring */}
              <div
                className={`absolute w-36 h-36 rounded-full border border-[#f59e0b]/40 transition-all duration-300 ${
                  isSpeaking ? 'scale-125 opacity-80 animate-ping' : 'scale-100 opacity-20'
                }`}
              />
              <div
                className={`absolute w-44 h-44 rounded-full border border-[#38bdf8]/30 transition-all duration-500 ${
                  isSpeaking ? 'scale-110 opacity-60' : 'scale-90 opacity-10'
                }`}
              />

              {/* Holographic Avatar Core */}
              <div className="relative w-28 h-28 rounded-full bg-gradient-to-b from-[#1c2230] to-[#0c0e14] border-2 border-[#f59e0b] shadow-[0_0_35px_rgba(245,158,11,0.35)] flex items-center justify-center overflow-hidden">
                <svg
                  viewBox="0 0 100 100"
                  className={`w-20 h-20 text-[#f59e0b] transition-transform duration-300 ${
                    isSpeaking ? 'scale-105' : 'scale-100'
                  }`}
                  fill="currentColor"
                >
                  {/* Stylized Silhouette */}
                  <path d="M50 20 A18 18 0 0 0 32 38 C32 46 36 51 40 54 C30 58 20 68 18 82 C28 85 40 86 50 86 C60 86 72 85 82 82 C80 68 70 58 60 54 C64 51 68 46 68 38 A18 18 0 0 0 50 20 Z" opacity="0.85" />
                  {/* Hair Accent Silhouette */}
                  <path d="M30 38 Q25 50 28 65 Q33 55 35 48 Z" opacity="0.6" />
                  <path d="M70 38 Q75 50 72 65 Q67 55 65 48 Z" opacity="0.6" />
                </svg>

                {/* Scanning Light Beam */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f59e0b]/15 to-transparent animate-pulse pointer-events-none" />
              </div>
            </div>

            {/* Status Information */}
            <div className="space-y-1.5 max-w-xs">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161b26] border border-[#2d374d] text-[#f59e0b] tracking-wider font-semibold">
                MODO SILHUETA HOLOGRÁFICA
              </span>
              <p className="text-[11px] text-[#8892a4] font-mono leading-relaxed">
                Assets visuais da persona não encontrados. Para usar sprites de anime, execute{' '}
                <code className="text-[#38bdf8] bg-[#121620] px-1 py-0.5 rounded">python scripts/setup_sprites.py</code>
              </p>
            </div>
          </div>
        )}
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
