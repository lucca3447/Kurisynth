import React, { useEffect, useRef } from 'react';
import { SpeechService } from '../services/speechService';

interface AudioOscilloscopeProps {
  isActive: boolean;
  isListening?: boolean;
  className?: string;
}

export const AudioOscilloscope: React.FC<AudioOscilloscopeProps> = ({
  isActive,
  isListening = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Dark obsidian background with slight persistence
      ctx.fillStyle = 'rgba(12, 14, 18, 0.28)';
      ctx.fillRect(0, 0, width, height);

      // Draw faint technical grid lines (amber/charcoal)
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.06)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      // Center horizontal line
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      // Vertical grid lines
      for (let x = 0; x < width; x += 32) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();

      // Check for real acoustic waveform from SpeechService AnalyserNode
      const analyser = SpeechService.getAnalyser();
      let hasRealAudio = false;

      if (isActive && analyser) {
        const timeData = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(timeData);

        let variance = 0;
        for (let i = 0; i < timeData.length; i++) {
          variance += Math.abs(timeData[i] - 128);
        }

        if (variance > 40) {
          hasRealAudio = true;
          ctx.beginPath();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 14;
          ctx.shadowColor = '#f59e0b';

          const sliceWidth = width / timeData.length;
          let currentX = 0;

          for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i] / 128.0;
            const y = (v * (height / 2));

            if (i === 0) {
              ctx.moveTo(currentX, y);
            } else {
              ctx.lineTo(currentX, y);
            }
            currentX += sliceWidth;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Draw aesthetic harmonic wave when not using real audio
      if (!hasRealAudio) {
        let baseAmplitude = 5;
        let speed = 0.05;

        if (isActive) {
          baseAmplitude = 22 + Math.sin(phase * 3) * 10;
          speed = 0.14;
        } else if (isListening) {
          baseAmplitude = 16 + Math.sin(phase * 4) * 8;
          speed = 0.12;
        }

        ctx.beginPath();
        ctx.strokeStyle = isActive ? '#f59e0b' : isListening ? '#38bdf8' : '#78350f';
        ctx.lineWidth = 2;
        ctx.shadowBlur = isActive || isListening ? 12 : 2;
        ctx.shadowColor = isActive ? '#f59e0b' : isListening ? '#38bdf8' : 'transparent';

        for (let x = 0; x < width; x++) {
          const wave1 = Math.sin(x * 0.03 + phase) * baseAmplitude;
          const wave2 = Math.sin(x * 0.07 - phase * 1.5) * (baseAmplitude * 0.4);
          const wave3 = Math.cos(x * 0.015 + phase * 0.5) * (baseAmplitude * 0.2);

          const taper = Math.sin((x / width) * Math.PI);
          const y = centerY + (wave1 + wave2 + wave3) * taper;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      phase += 0.06;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, isListening]);

  return (
    <div className={`relative border border-amadeus-border bg-[#0b0e14] rounded-lg overflow-hidden shadow-sm ${className}`}>
      <div className="absolute top-1.5 left-2.5 text-[10px] font-mono text-amadeus-muted tracking-wider flex items-center gap-1.5 z-10">
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#f59e0b] animate-ping' : isListening ? 'bg-[#38bdf8] animate-pulse' : 'bg-[#78350f]'}`} />
        <span className="text-[#94a3b8]">OSCILOSCÓPIO:</span>
        <span className={`font-semibold ${isActive ? 'text-[#f59e0b]' : isListening ? 'text-[#38bdf8]' : 'text-[#64748b]'}`}>
          {isActive ? 'VOZ TRANSMITINDO' : isListening ? 'MICROFONE ATIVO' : 'EM ESPERA'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={80}
        className="w-full h-full block"
      />
    </div>
  );
};
