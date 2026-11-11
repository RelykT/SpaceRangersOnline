/** Kinematics from release_v10/reference_renderer.py. Degrees, clockwise, y down. */

export interface Motion {
  type: 'sin' | 'open' | 'bob';
  amp_deg: number;
  cycles_per_loop?: number;
  phase_rad?: number;
  dx?: number;
  dy?: number;
}

export function flicker(t: number, i = 0.7): number {
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * 7 * t + i) * Math.sin(2 * Math.PI * 3 * t + 2 * i);
}

export function wave(motion: Motion, t: number): [number, number, number] {
  const tt = 2 * Math.PI * (motion.cycles_per_loop ?? 1) * t + (motion.phase_rad ?? 0);
  if (motion.type === 'sin') return [motion.amp_deg * Math.sin(tt), 0, 0];
  if (motion.type === 'open') return [motion.amp_deg * (0.5 - 0.5 * Math.cos(tt)), 0, 0];
  return [motion.amp_deg * Math.sin(tt), (motion.dx ?? 0) * Math.cos(tt), (motion.dy ?? 0) * Math.sin(tt)];
}

export function rot(x: number, y: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

export function wrapDeg(deg: number): number {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export function clampArc(deg: number, min: number, max: number): number {
  const d = wrapDeg(deg);
  if (d >= min && d <= max) return d;
  const toMin = Math.abs(wrapDeg(d - min));
  const toMax = Math.abs(wrapDeg(d - max));
  return toMin <= toMax ? min : max;
}

type AlphaFn = (t: number, sin: (x: number) => number, pi: number, flicker: (t: number, i?: number) => number) => number;

const alphaCache = new Map<string, AlphaFn>();

export function alphaAt(expr: string, t: number): number {
  let fn = alphaCache.get(expr);
  if (!fn) {
    fn = new Function('t', 'sin', 'pi', 'flicker', `"use strict"; return (${expr});`) as AlphaFn;
    alphaCache.set(expr, fn);
  }
  const value = fn(t, Math.sin, Math.PI, flicker);
  return Number.isFinite(value) ? value : 0.5;
}

export function loopT(time: number, loopS: number, speed = 1): number {
  const span = loopS / Math.max(0.2, speed);
  const u = ((time % span) + span) % span;
  return u / span;
}
