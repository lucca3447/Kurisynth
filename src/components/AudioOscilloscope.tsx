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

      // Dark background with slight phosphor persistence
      ctx.fillStyle = 'rgba(8, 13, 11, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Draw faint grid lines
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      // Center horizontal line
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      // Vertical grid lines
      for (let x = 0; x < width; x += 40) {
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
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#00ff88';

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
        let baseAmplitude = 6;
        let speed = 0.05;

        if (isActive) {
          baseAmplitude = 24 + Math.sin(phase * 3) * 12;
          speed = 0.14;
        } else if (isListening) {
          baseAmplitude = 18 + Math.sin(phase * 4) * 8;
          speed = 0.12;
        }

        ctx.beginPath();
        ctx.strokeStyle = isActive ? '#00ff88' : isListening ? '#38e1ff' : '#00aa55';
        ctx.lineWidth = 2;
        ctx.shadowBlur = isActive || isListening ? 10 : 3;
        ctx.shadowColor = isActive ? '#00ff88' : isListening ? '#38e1ff' : '#00aa55';

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
    <div className={`relative border border-amadeus-border bg-amadeus-panel rounded overflow-hidden ${className}`}>
      <div className="absolute top-1 left-2 text-[10px] font-mono text-amadeus-muted tracking-widest flex items-center gap-1.5 z-10">
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-amadeus-accent animate-ping' : isListening ? 'bg-amadeus-cyan animate-pulse' : 'bg-amadeus-border'}`} />
        <span>AUDIO WAVEFORM // {isActive ? 'TRANSMITTING' : isListening ? 'RECORDING' : 'IDLE'}</span>
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
