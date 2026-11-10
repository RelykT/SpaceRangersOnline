export type QualityName = 'auto' | 'low' | 'medium' | 'high';

export interface Quality {
  name: Exclude<QualityName, 'auto'>;
  dpr: number;
  stars: number;
  particles: number;
  shipAngles: number;
  shipPx: number;
  nebula: boolean;
  glow: boolean;
  rocks: number;
  trails: number;
}

const PRESETS: Record<Exclude<QualityName, 'auto'>, Omit<Quality, 'name'>> = {
  low: { dpr: 1, stars: 70, particles: 36, shipAngles: 8, shipPx: 42, nebula: false, glow: false, rocks: 10, trails: 4 },
  medium: { dpr: 1.25, stars: 140, particles: 110, shipAngles: 12, shipPx: 56, nebula: true, glow: true, rocks: 22, trails: 8 },
  high: { dpr: 1.75, stars: 220, particles: 240, shipAngles: 16, shipPx: 72, nebula: true, glow: true, rocks: 40, trails: 14 },
};

let chosen: QualityName = (localStorage.getItem('kromka-quality') as QualityName) || 'auto';

export function detectTier(): Exclude<QualityName, 'auto'> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (mem <= 2 || (coarse && cores <= 4 && mem <= 4)) return 'low';
  if (mem <= 4 || coarse || cores <= 4) return 'medium';
  return 'high';
}

export function qualityName(): QualityName {
  return chosen;
}

export function getQuality(): Quality {
  const name = chosen === 'auto' ? detectTier() : chosen;
  return { name, ...PRESETS[name] };
}

export function setQuality(name: QualityName): void {
  chosen = name;
  localStorage.setItem('kromka-quality', name);
}
