import { FACTION_ENGINE } from '../sim/content';
import { emissiveMask, ready, shipImage } from './art';
import { getQuality } from './quality';

/** Двойной удар и пауза. В бою период короче. */
export function heartPulse(time: number, combat: boolean): number {
  const period = combat ? 0.46 : 1.12;
  const u = ((time % period) + period) % period / period;
  const bump = (center: number, width: number) => {
    const d = Math.abs(u - center);
    return Math.exp(-(d * d) / (width * width));
  };
  return Math.min(1, bump(0.07, 0.038) + bump(0.2, 0.03) * 0.82);
}

const headings = new Map<string, { ang: number; bank: number }>();

export function bankOf(id: string, heading: number): number {
  const prev = headings.get(id);
  let bank = (prev?.bank ?? 0) * 0.82;
  if (prev) {
    let d = heading - prev.ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    bank += Math.max(-0.45, Math.min(0.45, -d * 2.4));
  }
  headings.set(id, { ang: heading, bank });
  return bank;
}

export interface Craft {
  id: string;
  x: number;
  y: number;
  heading: number;
  faction: string;
  hullId: string;
  size: number;
  time: number;
  combat: boolean;
  hullFrac: number;
  shieldFrac: number;
  flash: boolean;
  lightX: number;
  lightY: number;
}

let scratch: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function sheet(size: number): CanvasRenderingContext2D | null {
  const px = Math.max(32, Math.ceil(size));
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratchCtx = scratch.getContext('2d');
  }
  if (!scratch || !scratchCtx) return null;
  if (scratch.width !== px) {
    scratch.width = px;
    scratch.height = px;
  }
  scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
  scratchCtx.clearRect(0, 0, px, px);
  return scratchCtx;
}

export function drawCraft(ctx: CanvasRenderingContext2D, craft: Craft): void {
  const img = shipImage(craft.faction, craft.hullId);
  const size = craft.size;
  const bank = bankOf(craft.id, craft.heading);
  const spin = craft.heading + Math.PI / 2 + bank;
  if (!ready(img)) {
    ctx.save();
    ctx.translate(craft.x, craft.y);
    ctx.rotate(spin);
    ctx.fillStyle = '#8fb4d8';
    ctx.fillRect(-size * 0.15, -size * 0.28, size * 0.3, size * 0.56);
    ctx.restore();
    return;
  }
  const q = getQuality();
  const g = sheet(size + 8);
  if (!g || !scratch) return;
  const c = size / 2;
  g.save();
  g.translate(c, c);
  g.rotate(spin);
  g.drawImage(img, -size / 2, -size / 2, size, size);
  g.restore();
  if (q.glow) {
    const len = Math.hypot(craft.lightX, craft.lightY) || 1;
    const lx = craft.lightX / len;
    const ly = craft.lightY / len;
    const grad = g.createLinearGradient(c - lx * size, c - ly * size, c + lx * size, c + ly * size);
    grad.addColorStop(0, 'rgba(255,255,255,.42)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,12,.5)');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = grad;
    g.fillRect(0, 0, scratch.width, scratch.height);
    g.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.drawImage(scratch, craft.x - c + 5, craft.y - c + 7);
  ctx.globalAlpha = 1;
  ctx.drawImage(scratch, craft.x - c, craft.y - c);
  ctx.translate(craft.x, craft.y);
  ctx.rotate(spin);
  if (q.glow) paintEngines(ctx, craft, size);
  paintEmissive(ctx, craft, img, size);
  if (craft.faction === 'taeyori' && q.glow) paintRings(ctx, size, craft.time);
  if (craft.flash && craft.shieldFrac > 0.05) {
    ctx.strokeStyle = 'rgba(150,220,255,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.42, size * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (craft.hullFrac < 0.42) paintSmoke(ctx, size, craft.time, craft.hullFrac);
  ctx.restore();
}

function paintEngines(ctx: CanvasRenderingContext2D, craft: Craft, size: number): void {
  if (craft.faction === 'taeyori') return;
  const color = FACTION_ENGINE[craft.faction as keyof typeof FACTION_ENGINE] ?? '#9fd4ff';
  const flicker = 0.75 + Math.sin(craft.time * 28 + craft.x) * 0.25;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85 * flicker;
  const spots = craft.faction === 'human' ? [-0.16, 0.16] : [0];
  for (const ox of spots) {
    ctx.beginPath();
    ctx.ellipse(size * ox, size * 0.4, size * 0.05, size * 0.11 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintEmissive(ctx: CanvasRenderingContext2D, craft: Craft, img: HTMLImageElement, size: number): void {
  const kind = craft.faction === 'omnir' ? 'vein' : craft.faction === 'taeyori' ? 'crystal' : craft.faction === 'zhargi' ? 'amethyst' : null;
  if (!kind) return;
  const mask = emissiveMask(img, kind);
  if (!mask) return;
  const pulse = kind === 'vein' ? heartPulse(craft.time, craft.combat) : 0.45 + Math.sin(craft.time * (kind === 'crystal' ? 3.2 : 2.1)) * 0.35;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.25 + pulse * 0.75;
  ctx.drawImage(mask, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function paintRings(ctx: CanvasRenderingContext2D, size: number, time: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(214,186,255,.75)';
  ctx.lineWidth = 1.5;
  ctx.rotate(time * 0.8);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.46, size * 0.18, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.rotate(-time * 1.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.34, size * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function paintSmoke(ctx: CanvasRenderingContext2D, size: number, time: number, frac: number): void {
  ctx.save();
  ctx.fillStyle = `rgba(80,80,80,${0.35 + (0.42 - frac)})`;
  for (let i = 0; i < 4; i++) {
    const t = (time * 0.8 + i * 0.23) % 1;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.arc(Math.sin(i * 4 + time) * size * 0.08, size * 0.28 + t * size * 0.35, size * 0.05 * (1 + t), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
