import { FACTION_COLOR } from '../sim/content';
import { unit } from '../sim/rng';
import type { PlayableRace } from '../sim/types';

/** Drawn only for the screen. The seed is part of the captain and never touches the sim tick. */
export function drawPortrait(canvas: HTMLCanvasElement, race: PlayableRace, portrait: number, time: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const seed = (portrait + 1) * 97 + race.length * 13;
  ctx.clearRect(0, 0, w, h);
  const color = FACTION_COLOR[race];
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#101826');
  bg.addColorStop(1, color);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const cx = w * 0.5;
  const cy = h * 0.56;
  const head = Math.min(w, h) * (0.28 + unit(seed, 1) * 0.06);
  ctx.fillStyle = shade(color, unit(seed, 2) > 0.5 ? 40 : -20);
  ctx.beginPath();
  ctx.ellipse(cx, cy, head * 0.86, head, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(8,10,16,.85)';
  const eye = head * 0.16;
  const spread = head * (0.28 + unit(seed, 3) * 0.12);
  ctx.beginPath();
  ctx.ellipse(cx - spread, cy - eye, eye, eye * 0.7, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + spread, cy - eye, eye, eye * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(2, w * 0.03);
  const mark = Math.floor(unit(seed, 4) * 4);
  ctx.beginPath();
  if (mark === 0) ctx.arc(cx, cy - head * 1.15, head * 0.7, Math.PI * 1.05, Math.PI * 1.95);
  else if (mark === 1) {
    ctx.moveTo(cx - head, cy + head * 0.2);
    ctx.lineTo(cx, cy - head * 0.2);
    ctx.lineTo(cx + head, cy + head * 0.2);
  } else if (mark === 2) ctx.arc(cx, cy, head * 1.25, 0, Math.PI * 2);
  else {
    ctx.moveTo(w * 0.15, h * (0.2 + unit(seed, 5) * 0.2));
    ctx.lineTo(w * 0.85, h * (0.7 + unit(seed, 6) * 0.15));
  }
  ctx.stroke();
  ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 2 + portrait);
  ctx.fillStyle = '#fff';
  ctx.fillRect(w * 0.08, h * 0.08, w * 0.18, 3);
  ctx.globalAlpha = 1;
}

function shade(hex: string, delta: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.max(0, Math.min(255, ((n >> shift) & 255) + delta));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
