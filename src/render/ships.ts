import { FACTION_ENGINE } from '../sim/content';
import { glowImage, ready, shipFile, shipImage } from './art';
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
  thrust: number;
  boost: boolean;
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
  if (q.glow) paintGlow(ctx, craft, size);
  if (q.glow) paintFlameCore(ctx, craft, size);
  spawnExhaust(craft, spin, size);
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

const GLOW_TINT: Record<string, string> = {
  human: '#8ec8ff',
  zhargi: '#ff7a32',
  kvissae: '#5ee0c8',
  taeyori: '#d7b6ff',
  virex: '#49c8ff',
  omnir: '#ff2a3c',
  free: '#8ec8ff',
  pirate: '#ff7a45',
};

const tinted = new Map<string, HTMLCanvasElement>();

function tintGlow(mask: HTMLImageElement, color: string): HTMLCanvasElement | null {
  if (!ready(mask)) return null;
  const key = `${mask.src}|${color}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = mask.naturalWidth;
  c.height = mask.naturalHeight;
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  tinted.set(key, c);
  return c;
}

function glowAmount(craft: Craft, low: boolean): number {
  const t = craft.time;
  if (craft.faction === 'human') {
    const blink = !low && Math.sin(t * 1.15) > 0.985 ? 0.4 : 0;
    return 0.62 + blink;
  }
  if (craft.faction === 'zhargi') return 0.38 + (0.5 + 0.5 * Math.sin(t * 0.85)) * 0.5;
  if (craft.faction === 'kvissae') return 0.4 + (low ? 0.15 : 0.28) * Math.sin(t * 2.2);
  if (craft.faction === 'taeyori') return 0.32 + (0.5 + 0.5 * Math.sin(t * 3.5)) * 0.45;
  if (craft.faction === 'virex') return 0.42 + (low ? 0.12 : 0.2) * Math.sin(t * 5);
  if (craft.faction === 'omnir') return 0.18 + heartPulse(t, craft.combat) * 0.9;
  return 0.5;
}

function paintGlow(ctx: CanvasRenderingContext2D, craft: Craft, size: number): void {
  const mask = glowImage(craft.faction, craft.hullId);
  const tint = GLOW_TINT[craft.faction] ?? '#ffffff';
  const painted = tintGlow(mask, craft.faction === 'kvissae' ? '#e6c36a' : tint);
  const base = tintGlow(mask, tint);
  if (!base) return;
  const low = getQuality().name === 'low';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = glowAmount(craft, low);
  ctx.drawImage(base, -size / 2, -size / 2, size, size);
  if (!low && (craft.faction === 'kvissae' || craft.faction === 'virex') && painted) {
    const travel = ((craft.time * (craft.faction === 'virex' ? 0.55 : 0.32)) % 1);
    const y = -size / 2 + travel * size;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-size / 2, y - size * 0.07, size, size * 0.14);
    ctx.clip();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(painted, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  if (craft.faction === 'taeyori') paintRings(ctx, size, craft.time);
  ctx.restore();
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
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(craft.time * 4);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  for (const n of nozzles(shipFile(craft.faction, craft.hullId))) {
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

function nozzles(file: string): { x: number; y: number }[] {
  const table: Record<string, { x: number; y: number }[]> = {
    human_fighter: [{ x: -0.3, y: 0.36 }, { x: 0.3, y: 0.36 }],
    human_frigate: [{ x: -0.14, y: 0.38 }, { x: 0.14, y: 0.38 }],
    human_trader: [{ x: 0, y: 0.44 }],
    human_cruiser: [{ x: -0.16, y: 0.38 }, { x: 0.16, y: 0.38 }],
    human_carrier: [{ x: -0.24, y: 0.36 }, { x: 0.24, y: 0.36 }],
    zhargi_fighter: [{ x: 0, y: 0.42 }],
    zhargi_frigate: [{ x: 0, y: 0.44 }],
    zhargi_trader: [{ x: -0.22, y: 0.34 }, { x: 0.22, y: 0.34 }],
    zhargi_battleship: [{ x: -0.1, y: 0.38 }, { x: 0.1, y: 0.38 }],
    zhargi_gate: [{ x: -0.12, y: 0.36 }, { x: 0.12, y: 0.36 }],
    kvissae_fighter: [{ x: -0.28, y: 0.3 }, { x: 0.28, y: 0.3 }],
    kvissae_frigate: [{ x: -0.36, y: 0.32 }, { x: 0.36, y: 0.32 }],
    kvissae_trader: [{ x: -0.1, y: 0.36 }, { x: 0.1, y: 0.36 }],
    kvissae_cruiser: [{ x: -0.1, y: 0.36 }, { x: 0.1, y: 0.36 }],
    kvissae_fan: [{ x: -0.16, y: 0.34 }, { x: 0.16, y: 0.34 }],
    omnir_fighter: [{ x: 0, y: 0.4 }],
    omnir_frigate: [{ x: -0.12, y: 0.36 }, { x: 0.12, y: 0.36 }],
    omnir_trader: [{ x: -0.1, y: 0.38 }, { x: 0.1, y: 0.38 }],
    omnir_battleship: [{ x: 0, y: 0.4 }],
    omnir_hivemaw: [{ x: -0.22, y: 0.34 }, { x: 0.22, y: 0.34 }, { x: 0, y: 0.4 }],
    vireks_fighter: [{ x: -0.12, y: 0.36 }, { x: 0.12, y: 0.36 }],
    vireks_frigate: [{ x: -0.16, y: 0.36 }, { x: 0.16, y: 0.36 }],
    vireks_trader: [{ x: -0.14, y: 0.36 }, { x: 0.14, y: 0.36 }],
    vireks_cruiser: [{ x: -0.18, y: 0.34 }, { x: 0.18, y: 0.34 }],
    vireks_mother: [{ x: -0.16, y: 0.34 }, { x: 0.16, y: 0.34 }],
  };
  return table[file] ?? [{ x: 0, y: 0.4 }];
}

function toWorld(x: number, y: number, spin: number, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(spin);
  const s = Math.sin(spin);
  return { x: x + lx * c - ly * s, y: y + lx * s + ly * c };
}

function spawnExhaust(craft: Craft, spin: number, size: number): void {
  stepPuffs(craft.time);
  const low = getQuality().name === 'low';
  const file = shipFile(craft.faction, craft.hullId);
  const thrust = Math.max(0, Math.min(1, craft.thrust));
  const boosting = craft.boost && thrust > 0.2;
  const color = craft.faction === 'omnir' ? '#ff2438' : (FACTION_ENGINE[craft.faction as keyof typeof FACTION_ENGINE] ?? '#9fd4ff');
  const dirx = -Math.sin(spin);
  const diry = Math.cos(spin);
  const speed = (90 + thrust * 260) * (boosting ? 1.7 : 1);
  const life = (0.12 + thrust * 0.2) * (boosting ? 1.45 : 1);
  if (craft.faction === 'taeyori') {
    if (low && Math.random() > 0.35) return;
    const count = low ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = size * (0.15 + Math.random() * 0.25);
      const at = toWorld(craft.x, craft.y, spin, Math.cos(a) * rad, Math.sin(a) * rad);
      puffs.push({
        x: at.x, y: at.y,
        vx: Math.cos(a) * 18, vy: Math.sin(a) * 18,
        life: 0.35, max: 0.35, r: 1.5 + Math.random() * 1.5,
        hot: '#ffffff', cool: '#d7b6ff',
      });
    }
    return;
  }
  if (thrust < 0.05 && Math.abs(headings.get(craft.id)?.bank ?? 0) < 0.1) return;
  const ports = nozzles(file);
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
