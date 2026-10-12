import React from 'react';

interface LabBackgroundProps {
  scanlines?: boolean;
}

export const LabBackground: React.FC<LabBackgroundProps> = ({ scanlines = false }) => {
  return (
    <>
      {/* Background Grid Pattern ("Quadradinhos") */}
      <div className="fixed inset-0 bg-grid-amadeus pointer-events-none -z-20" />

      {/* Subtle Floating Binary Traces from Steins;Gate 0 Login Screen */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden opacity-[0.06] font-mono text-xs text-[#f59e0b] leading-relaxed flex justify-between px-8 py-14 -z-10">
        <div className="space-y-1">
          <div>/11111111100000101010</div>
          <div>/0000000000000001010101000</div>
          <div>/101010101011000001110010100101</div>
          <div>/110000000111101011111110110</div>
          <div>/1100011111011</div>
          <div>/1100000010110111101000111</div>
          <div>/000001010010100</div>
          <div>/1111111110000101010</div>
        </div>
        <div className="space-y-1 text-right">
          <div>/0000011100000010</div>
          <div>/1100000101111110010</div>
          <div>/011010101000000000111100</div>
          <div>/11010101000100000</div>
          <div>/000000011111000101100011</div>
          <div>/1111111110000101010</div>
          <div>/101010101011000001110010100101</div>
        </div>
      </div>

      {/* Toggleable CRT Scanline Overlay */}
      {scanlines && (
        <div className="fixed inset-0 crt-scanlines pointer-events-none z-50" />
      )}
    </>
  );
};
