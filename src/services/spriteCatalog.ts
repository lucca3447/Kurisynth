import { Emotion } from '../types/amadeus';

export interface SpriteFrames {
  idle: string;   // 00: mouth closed, eyes open
  talk: string;   // 01: mouth open, eyes open
  blink: string;  // 02: eyes closed
}

// Maps emotional states to exact visual novel sprite trios for Makise Kurisu
export const KURISU_SPRITES: Record<Emotion, SpriteFrames> = {
  neutral: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000100.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000101.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000102.png',
  },
  smile: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000200.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000201.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000202.png',
  },
  happy: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000300.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000301.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000302.png',
  },
  serious: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000400.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000401.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000402.png',
  },
  annoyed: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000500.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000501.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000502.png',
  },
  surprised: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000600.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000601.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000602.png',
  },
  tsundere: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000700.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000701.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000702.png',
  },
  thinking: {
    idle: '/assets/sprites/kurisu/CRS_JLE_40000100.png',
    talk: '/assets/sprites/kurisu/CRS_JLE_40000101.png',
    blink: '/assets/sprites/kurisu/CRS_JLE_40000102.png',
  },
  smug: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000800.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000801.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000802.png',
  },
  flustered: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000b00.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000b01.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000b02.png',
  },
  sad: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000900.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000901.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000902.png',
  },
  puzzled: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000a00.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000a01.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000a02.png',
  },
  desperate: {
    idle: '/assets/sprites/kurisu/CRS_JLD_40000c00.png',
    talk: '/assets/sprites/kurisu/CRS_JLD_40000c01.png',
    blink: '/assets/sprites/kurisu/CRS_JLD_40000c02.png',
  },
};

/**
 * Preloads all primary sprite frames to ensure zero lag or flicker when changing expressions
 */
export function preloadPrimarySprites(): void {
  const urlsToPreload = new Set<string>();
  Object.values(KURISU_SPRITES).forEach((frames) => {
    urlsToPreload.add(frames.idle);
    urlsToPreload.add(frames.talk);
    urlsToPreload.add(frames.blink);
  });

  urlsToPreload.forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}
