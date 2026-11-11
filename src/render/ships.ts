import { FACTION_ENGINE } from '../sim/content';
import { getQuality } from './quality';
import { nozzleLocal, paintShip } from './v10draw';

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
  thrust: number;
  boost: boolean;
  /** Fitted modules. Weapon slots change the turret sprite on the matching socket. */
  weapons?: (string | null)[];
  /** Screen-space aim point. Turrets traverse inside their arc. */
  aimX?: number;
  aimY?: number;
  /** Fitted guns that are currently firing, same order as weapon modules. */
  hot?: boolean[];
  /** 0..1, set only on a fresh shield hit. */
  ripple?: number;
  /** World angle of the incoming shot, radians. */
  rippleAng?: number;
}

export function aimDegrees(x: number, y: number, aimX: number, aimY: number, spin: number): number {
  const dx = aimX - x;
  const dy = aimY - y;
  const c = Math.cos(spin);
  const s = Math.sin(spin);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  return (Math.atan2(lx, -ly) * 180) / Math.PI;
}

let sheet: HTMLCanvasElement | null = null;
let sheetCtx: CanvasRenderingContext2D | null = null;

function shipSheet(px: number): CanvasRenderingContext2D | null {
  const side = Math.max(32, Math.ceil(px));
  if (!sheet) {
    sheet = document.createElement('canvas');
    sheetCtx = sheet.getContext('2d');
  }
  if (!sheet || !sheetCtx) return null;
  if (sheet.width !== side || sheet.height !== side) {
    sheet.width = side;
    sheet.height = side;
  }
  sheetCtx.setTransform(1, 0, 0, 1, 0, 0);
  sheetCtx.clearRect(0, 0, side, side);
  return sheetCtx;
}

/** Star light stays inside the hull alpha, so the sprite square does not tint the sky. */
function paintHullLight(g: CanvasRenderingContext2D, craft: Craft, size: number, spin: number): void {
  const len = Math.hypot(craft.lightX, craft.lightY) || 1;
  const sx = craft.lightX / len;
  const sy = craft.lightY / len;
  const c = Math.cos(spin);
  const s = Math.sin(spin);
  const lx = sx * c + sy * s;
  const ly = -sx * s + sy * c;
  const grad = g.createLinearGradient(-lx * size, -ly * size, lx * size, ly * size);
  grad.addColorStop(0, 'rgba(255,255,255,.34)');
  grad.addColorStop(0.48, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,16,.42)');
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = grad;
  g.fillRect(-size * 2, -size * 2, size * 4, size * 4);
  g.restore();
}

export function drawCraft(ctx: CanvasRenderingContext2D, craft: Craft): void {
  const size = craft.size;
  const bank = bankOf(craft.id, craft.heading);
  const spin = craft.heading + Math.PI / 2 + bank;
  const q = getQuality();
  const pad = size * 0.55;
  const side = Math.ceil(size + pad * 2);
  const g = shipSheet(side);
  const aimDeg = craft.aimX == null || craft.aimY == null ? null : aimDegrees(craft.x, craft.y, craft.aimX, craft.aimY, spin);
  let painted = false;
  if (g && sheet) {
    g.translate(side / 2, side / 2);
    painted = paintShip(g, {
      faction: craft.faction,
      hullId: craft.hullId,
      size,
      time: craft.time,
      combat: craft.combat,
      weapons: craft.weapons,
      aimDeg,
      hot: craft.hot,
    });
    if (painted && q.glow) paintHullLight(g, craft, size, spin);
  }
  ctx.save();
  ctx.translate(craft.x, craft.y);
  ctx.rotate(spin);
  paintFlameCore(ctx, craft, size);
  if (painted && sheet) ctx.drawImage(sheet, -side / 2, -side / 2);
  else if (!painted) {
    ctx.fillStyle = '#8fb4d8';
    ctx.fillRect(-size * 0.15, -size * 0.28, size * 0.3, size * 0.56);
  }
  if (craft.ripple && craft.ripple > 0.02 && craft.shieldFrac > 0.05) {
    const local = (craft.rippleAng ?? 0) - spin;
    ctx.save();
    ctx.globalAlpha = craft.ripple;
    ctx.strokeStyle = 'rgba(170,230,255,.95)';
    ctx.lineWidth = 2 + craft.ripple * 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * (0.42 + (1 - craft.ripple) * 0.08), local - 0.7, local + 0.7);
    ctx.stroke();
    ctx.restore();
  }
  if (craft.hullFrac < 0.4) paintSmoke(ctx, size, craft.time, craft.hullFrac);
  ctx.restore();
  spawnExhaust(craft, spin, size);
}

function paintFlameCore(ctx: CanvasRenderingContext2D, craft: Craft, size: number): void {
  const thrust = Math.max(0, Math.min(1, craft.thrust));
  if (thrust < 0.04 && !craft.boost) return;
  const power = thrust * (craft.boost ? 2.3 : 1);
  const color = craft.faction === 'omnir' ? '#ff2438' : (FACTION_ENGINE[craft.faction as keyof typeof FACTION_ENGINE] ?? '#9fd4ff');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (craft.faction === 'taeyori') {
    ctx.fillStyle = '#efe6ff';
    ctx.globalAlpha = 0.45 + 0.25 * Math.sin(craft.time * 6);
    for (const n of nozzleLocal(craft.faction, craft.hullId)) {
      ctx.beginPath();
      ctx.arc(n.x * size, n.y * size, Math.max(1.2, size * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  for (const n of nozzleLocal(craft.faction, craft.hullId)) {
    const nx = n.x * size;
    const ny = n.y * size;
    const len = size * (0.05 + power * 0.12);
    const half = Math.max(1.5, size * 0.018);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(nx, ny + len * 0.25, half, len * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(nx, ny + len * 0.62, half * 1.6, len * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  hot: string;
  cool: string;
}

const puffs: Puff[] = [];
let steppedAt = -1;

function toWorld(x: number, y: number, spin: number, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(spin);
  const s = Math.sin(spin);
  return { x: x + lx * c - ly * s, y: y + lx * s + ly * c };
}

function spawnExhaust(craft: Craft, spin: number, size: number): void {
  stepPuffs(craft.time);
  const low = getQuality().name === 'low';
  const thrust = Math.max(0, Math.min(1, craft.thrust));
  const boosting = craft.boost && thrust > 0.2;
  const color = craft.faction === 'omnir' ? '#ff2438' : (FACTION_ENGINE[craft.faction as keyof typeof FACTION_ENGINE] ?? '#9fd4ff');
  const dirx = -Math.sin(spin);
  const diry = Math.cos(spin);
  const speed = (90 + thrust * 260) * (boosting ? 1.7 : 1);
  const life = (0.12 + thrust * 0.2) * (boosting ? 1.45 : 1);
  if (craft.faction === 'taeyori') {
    if (low && Math.random() > 0.45) return;
    for (const n of nozzleLocal(craft.faction, craft.hullId)) {
      const at = toWorld(craft.x, craft.y, spin, n.x * size, n.y * size);
      const a = Math.random() * Math.PI * 2;
      puffs.push({
        x: at.x, y: at.y,
        vx: Math.cos(a) * 22, vy: Math.sin(a) * 22,
        life: 0.32, max: 0.32, r: 1.2 + Math.random(),
        hot: '#ffffff', cool: '#d7b6ff',
      });
    }
    return;
  }
  if (thrust < 0.05 && Math.abs(headings.get(craft.id)?.bank ?? 0) < 0.1) return;
  const ports = nozzleLocal(craft.faction, craft.hullId);
  const per = low ? 1 : boosting ? 3 : 1;
  if (thrust >= 0.05) {
    for (const n of ports) {
      for (let i = 0; i < per; i++) {
        const at = toWorld(craft.x, craft.y, spin, n.x * size, n.y * size);
        const spread = (Math.random() - 0.5) * 40;
        puffs.push({
          x: at.x, y: at.y,
          vx: dirx * speed + -diry * spread,
          vy: diry * speed + dirx * spread,
          life, max: life,
          r: (boosting ? 3.2 : 1.8) * (0.6 + Math.random()),
          hot: '#ffffff',
          cool: color,
        });
      }
    }
  }
  const bank = headings.get(craft.id)?.bank ?? 0;
  if (Math.abs(bank) > 0.12 && !low) {
    const side = bank > 0 ? -1 : 1;
    const at = toWorld(craft.x, craft.y, spin, side * size * 0.28, size * 0.02);
    puffs.push({
      x: at.x, y: at.y,
      vx: -diry * side * 70, vy: dirx * side * 70,
      life: 0.12, max: 0.12, r: 1.4,
      hot: '#ffffff', cool: '#b7d4ff',
    });
  }
}

function stepPuffs(time: number): void {
  if (time === steppedAt) return;
  const dt = steppedAt < 0 ? 0.016 : Math.min(0.05, Math.max(0.001, time - steppedAt));
  steppedAt = time;
  for (const p of puffs) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.life -= dt;
  }
  const cap = getQuality().name === 'low' ? 90 : 260;
  while (puffs.length > cap) puffs.shift();
  for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i]!.life <= 0) puffs.splice(i, 1);
}

export function paintExhaust(ctx: CanvasRenderingContext2D): void {
  if (!puffs.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of puffs) {
    const k = Math.max(0, p.life / p.max);
    ctx.globalAlpha = k * k;
    ctx.fillStyle = k > 0.55 ? p.hot : p.cool;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1.4 - k), 0, Math.PI * 2);
    ctx.fill();
  }
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
