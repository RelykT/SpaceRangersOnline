import { FACTION_COLOR } from '../sim/content';
import { unit } from '../sim/rng';
import type { CareerId, PlayableRace } from '../sim/types';

/** Layered original portrait. Variant count is the portrait number. */
export function drawPortrait(canvas: HTMLCanvasElement, race: PlayableRace, portrait: number, time: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const variant = Math.abs(portrait | 0);
  const seed = variant * 131 + race.charCodeAt(0) * 17;
  const female = variant % 2 === 0;
  const look = variant % 4;
  ctx.clearRect(0, 0, w, h);
  const accent = FACTION_COLOR[race];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, race === 'taeyori' ? '#10242c' : race === 'virex' ? '#2a2014' : '#1a2740');
  g.addColorStop(1, '#070b14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  drawEmblemMark(ctx, w * 0.84, h * 0.14, w * 0.1, race);
  if (race === 'human') paintEira(ctx, w, h, seed, female, look, time);
  else if (race === 'zhargi') paintRegnar(ctx, w, h, seed, female, look, accent);
  else if (race === 'kvissae') paintSolari(ctx, w, h, seed, female, look, accent, time);
  else if (race === 'taeyori') paintNimva(ctx, w, h, seed, female, look, accent, time);
  else paintVekt(ctx, w, h, seed, female, look, accent);
  ctx.strokeStyle = 'rgba(224,181,101,.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
}

function paintEira(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, female: boolean, look: number, time: number): void {
  const skin = ['#f0c9a0', '#c6865a', '#8d5528', '#f6d7b8'][look]!;
  const cx = w * 0.5;
  const cy = h * 0.46;
  const hw = w * (female ? 0.22 : 0.28) * (look === 2 ? 0.86 : 1);
  const hh = h * (female ? 0.26 : 0.22);
  fillFace(ctx, cx, cy, hw, hh, skin, look === 1 ? 0.28 : 0.08);
  const color = ['#2a2118', '#6a3a22', '#111', '#d8c07a'][look]!;
  if (look === 0) hair(ctx, cx, cy - hh * 0.55, hw * 1.2, hh * 1.15, color, true, seed);
  else if (look === 2) {
    ctx.fillStyle = color;
    ctx.fillRect(cx - hw * 0.15, cy - hh * 1.15, hw * 0.3, hh * 0.35);
  } else hair(ctx, cx, cy - hh * 0.75, hw * (look === 3 ? 1.25 : 1.05), hh * 0.55, color, false, seed);
  humanEyes(ctx, cx, cy - hh * 0.05, hw, look === 3 ? '#6a8f4e' : '#1a2744', time, seed);
  noseMouth(ctx, cx, cy, hw, hh, skin);
  if (look === 1) scar(ctx, cx - hw * 0.35, cy - hh * 0.1, hw);
  if (look === 1 && !female) {
    ctx.fillStyle = shade(skin, -30);
    ctx.beginPath();
    ctx.ellipse(cx, cy + hh * 0.72, hw * 0.55, hh * 0.2, 0, 0, Math.PI);
    ctx.fill();
  }
  if (look === 0) {
    ctx.fillStyle = '#e0b565';
    ctx.beginPath();
    ctx.arc(cx - hw * 1.05, cy + hh * 0.1, 3, 0, Math.PI * 2);
    ctx.arc(cx + hw * 1.05, cy + hh * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  collar(ctx, cx, cy + hh, w, h, look === 3 ? '#1c2838' : '#243044', '#8ec8ff');
}

function paintRegnar(ctx: CanvasRenderingContext2D, w: number, h: number, _seed: number, female: boolean, look: number, accent: string): void {
  const rock = ['#4a342c', '#3a241c', '#5c3a30', '#2c1814'][look]!;
  const cx = w * 0.5;
  const cy = h * 0.48;
  const hw = w * (female ? 0.3 : 0.36);
  const hh = h * 0.24;
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh * 1.2);
  ctx.lineTo(cx + hw, cy - hh * 0.2);
  ctx.lineTo(cx + hw * 0.72, cy + hh);
  ctx.lineTo(cx, cy + hh * 1.15);
  ctx.lineTo(cx - hw * 0.8, cy + hh * 0.85);
  ctx.lineTo(cx - hw, cy - hh * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.4, cy - hh * 0.4);
  ctx.lineTo(cx + hw * 0.1, cy + hh * 0.15);
  ctx.lineTo(cx - hw * 0.05, cy + hh * 0.7);
  if (look % 2 === 0) {
    ctx.moveTo(cx + hw * 0.2, cy - hh * 0.2);
    ctx.lineTo(cx + hw * 0.55, cy + hh * 0.45);
  }
  ctx.stroke();
  ctx.fillStyle = '#ffb15a';
  const spikes = look === 0 ? 3 : look === 2 ? 1 : 4;
  for (let i = 0; i < spikes; i++) {
    const x = cx + (i - (spikes - 1) / 2) * hw * 0.35;
    ctx.beginPath();
    ctx.moveTo(x - 6, cy - hh * 0.9);
    ctx.lineTo(x, cy - hh * (1.45 + (i % 2) * 0.35));
    ctx.lineTo(x + 6, cy - hh * 0.9);
    ctx.fill();
  }
  ctx.fillStyle = '#2a0604';
  ctx.beginPath();
  ctx.ellipse(cx - hw * 0.28, cy, 7, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + hw * 0.28, cy, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx - hw * 0.28, cy, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + hw * 0.28, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  collar(ctx, cx, cy + hh, w, h, '#2a140e', accent);
}

function paintSolari(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, female: boolean, look: number, accent: string, time: number): void {
  const skin = ['#f6e0b0', '#e7c48a', '#d7a86a', '#fff1d2'][look]!;
  const cx = w * 0.5;
  const cy = h * 0.48;
  const hw = w * (look === 1 ? 0.28 : 0.18);
  const hh = h * (look === 0 ? 0.32 : female ? 0.24 : 0.26);
  ctx.fillStyle = skin;
  ctx.beginPath();
  if (look === 2) {
    ctx.ellipse(cx, cy, hw, hh * 0.85, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(cx, cy - hh);
    ctx.bezierCurveTo(cx + hw * 0.7, cy - hh, cx + hw * 0.55, cy + hh * 0.2, cx + hw * 0.28, cy + hh);
    ctx.lineTo(cx - hw * 0.28, cy + hh);
    ctx.bezierCurveTo(cx - hw * 0.55, cy + hh * 0.2, cx - hw * 0.7, cy - hh, cx, cy - hh);
  }
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  if (look === 1) {
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(cx + i * hw * 0.28, cy - hh * 0.7);
      ctx.lineTo(cx + i * hw * 0.42, cy - hh * 1.25);
    }
    ctx.stroke();
  } else if (look === 3) {
    ctx.strokeRect(cx - hw * 0.7, cy - hh * 0.35, hw * 1.4, hh * 0.35);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy - hh * 0.15, hw * (look === 2 ? 1.2 : 0.9), Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  humanEyes(ctx, cx, cy - hh * 0.05, hw * 0.85, '#5a3a10', time, seed);
  if (look === 2) {
    ctx.fillStyle = accent;
    ctx.fillRect(cx - 2, cy + hh * 0.25, 4, hh * 0.35);
  }
  collar(ctx, cx, cy + hh * 0.9, w, h, '#3a3420', accent);
}

function paintNimva(ctx: CanvasRenderingContext2D, w: number, h: number, _seed: number, _female: boolean, look: number, accent: string, time: number): void {
  const skin = ['#d5ece8', '#b7ddd6', '#efe8ff', '#9fd0ea'][look]!;
  const cx = w * 0.5;
  const cy = h * 0.46;
  const hw = w * (look === 1 ? 0.32 : 0.2);
  const hh = h * (look === 0 ? 0.34 : 0.26);
  ctx.fillStyle = 'rgba(62,207,178,.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, hw * 1.45, hh * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  if (look === 3) {
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
  } else ctx.ellipse(cx, cy, hw * 0.72, hh, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(125,255,240,${0.7 + Math.sin(time) * 0.2})`;
  ctx.beginPath();
  ctx.ellipse(cx - hw * 0.28, cy - hh * 0.05, hw * 0.18, hh * 0.14, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + hw * 0.28, cy - hh * 0.05, hw * 0.18, hh * 0.14, 0, 0, Math.PI * 2);
  if (look === 1) ctx.ellipse(cx, cy - hh * 0.45, hw * 0.12, hh * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (look === 2) {
    ctx.strokeStyle = accent;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(cx + i * hw * 0.35, cy - hh * 0.8);
      ctx.quadraticCurveTo(cx + i * hw * 0.5, cy - hh * 1.4, cx + i * hw * 0.2, cy - hh * 1.7);
    }
    ctx.stroke();
  }
  if (look === 0) {
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.arc(cx - hw * 0.9, cy, 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  collar(ctx, cx, cy + hh * 0.85, w, h, '#10282c', accent);
}

function paintVekt(ctx: CanvasRenderingContext2D, w: number, h: number, _seed: number, female: boolean, look: number, accent: string): void {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const hw = w * (female ? 0.24 : 0.32);
  const hh = h * (look === 1 ? 0.22 : 0.16);
  ctx.fillStyle = '#5a4632';
  if (look === 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, hw, 0, Math.PI * 2);
    ctx.fill();
  } else ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2.2);
  ctx.fillStyle = '#c48a58';
  if (look === 3) ctx.fillRect(cx - hw * 0.7, cy - hh * 0.2, hw * 1.4, hh * 1.3);
  else if (look === 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, hw * 0.62, 0, Math.PI * 2);
    ctx.fill();
  } else ctx.fillRect(cx - hw * 0.72, cy - hh * 0.7, hw * 1.44, hh * 1.5);
  ctx.fillStyle = look === 2 ? '#9ad7ff' : '#111';
  ctx.fillRect(cx - hw * 0.5, cy - hh * 0.15, hw * 0.38, hh * 0.32);
  ctx.fillStyle = accent;
  ctx.fillRect(cx + hw * 0.08, cy - hh * 0.15, hw * 0.4, hh * 0.32);
  ctx.strokeStyle = '#c8c8c8';
  ctx.beginPath();
  if (look === 2) {
    ctx.moveTo(cx - hw * 0.3, cy - hh * 1.1);
    ctx.lineTo(cx - hw * 0.3, cy - hh * 1.8);
    ctx.moveTo(cx + hw * 0.3, cy - hh * 1.1);
    ctx.lineTo(cx + hw * 0.3, cy - hh * 1.8);
  } else {
    ctx.moveTo(cx + hw * 0.75, cy);
    ctx.lineTo(cx + hw * 1.15, cy + hh * (look === 0 ? 0.2 : 0.7));
  }
  ctx.stroke();
  if (look === 0) {
    ctx.strokeStyle = accent;
    ctx.strokeRect(cx - hw * 0.95, cy - hh * 0.15, hw * 0.22, hh * 0.55);
  }
  collar(ctx, cx, cy + hh * 1.15, w, h, '#3a2a18', accent);
}

function fillFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, skin: string, jaw: number): void {
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.bezierCurveTo(cx + hw, cy - hh * 0.2, cx + hw * (0.8 - jaw), cy + hh * 0.55, cx, cy + hh);
  ctx.bezierCurveTo(cx - hw * (0.8 - jaw), cy + hh * 0.55, cx - hw, cy - hh * 0.2, cx, cy - hh);
  ctx.fill();
}

function hair(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hh: number, color: string, female: boolean, seed: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (female && unit(seed, 4) > 0.5) ctx.ellipse(x, y + hh * 0.4, hw, hh * 1.4, 0, Math.PI, 0);
  else ctx.ellipse(x, y, hw, hh, 0, Math.PI, 0);
  ctx.fill();
}

function humanEyes(ctx: CanvasRenderingContext2D, cx: number, y: number, hw: number, iris: string, time: number, seed: number): void {
  const spread = hw * 0.42;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(cx - spread, y, hw * 0.16, hw * 0.09, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + spread, y, hw * 0.16, hw * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  const look = Math.sin(time + seed) * 2;
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(cx - spread + look, y, hw * 0.06, 0, Math.PI * 2);
  ctx.arc(cx + spread + look, y, hw * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function noseMouth(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, skin: string): void {
  ctx.strokeStyle = shade(skin, -40);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + hw * 0.06, cy + hh * 0.22);
  ctx.moveTo(cx - hw * 0.16, cy + hh * 0.48);
  ctx.quadraticCurveTo(cx, cy + hh * 0.58, cx + hw * 0.16, cy + hh * 0.48);
  ctx.stroke();
}

function scar(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number): void {
  ctx.strokeStyle = 'rgba(120,30,30,.75)';
  ctx.beginPath();
  ctx.moveTo(x, y - hw * 0.2);
  ctx.lineTo(x + hw * 0.25, y + hw * 0.25);
  ctx.stroke();
}

function collar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cloth: string, accent: string): void {
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(x - w * 0.22, y);
  ctx.lineTo(x, y + 10);
  ctx.lineTo(x + w * 0.22, y);
  ctx.lineTo(w, h);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.12, y + 4);
  ctx.lineTo(x + w * 0.12, y + 4);
  ctx.stroke();
}

export function drawEmblem(canvas: HTMLCanvasElement, race: PlayableRace): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  ctx.clearRect(0, 0, w, canvas.height);
  drawEmblemMark(ctx, w / 2, canvas.height / 2, w * 0.42, race);
}

export function drawCareerBadge(canvas: HTMLCanvasElement, career: CareerId): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.strokeStyle = '#e0b565';
  ctx.fillStyle = 'rgba(224,181,101,.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (career === 'trader') {
    ctx.moveTo(-w * 0.28, h * 0.1);
    ctx.lineTo(w * 0.05, h * 0.28);
    ctx.lineTo(w * 0.32, -h * 0.05);
    ctx.lineTo(w * 0.1, -h * 0.28);
  } else if (career === 'soldier') {
    ctx.moveTo(0, -h * 0.34);
    ctx.lineTo(w * 0.16, h * 0.2);
    ctx.lineTo(0, h * 0.05);
    ctx.lineTo(-w * 0.16, h * 0.2);
  } else if (career === 'hunter') {
    ctx.arc(0, 0, w * 0.22, 0, Math.PI * 2);
    ctx.moveTo(w * 0.28, -h * 0.2);
    ctx.lineTo(-w * 0.05, h * 0.28);
  } else if (career === 'explorer') {
    ctx.moveTo(0, -h * 0.3);
    ctx.lineTo(w * 0.22, 0);
    ctx.lineTo(0, h * 0.3);
    ctx.lineTo(-w * 0.22, 0);
  } else {
    ctx.moveTo(-w * 0.3, h * 0.15);
    ctx.lineTo(w * 0.3, -h * 0.15);
    ctx.moveTo(w * 0.05, -h * 0.28);
    ctx.lineTo(w * 0.28, -h * 0.05);
  }
  ctx.fill();
  ctx.stroke();
}

export function drawGoodIcon(canvas: HTMLCanvasElement, goodId: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = '#121c30';
  ctx.fillRect(0, 0, s, s);
  const colors: Record<string, string> = {
    ore: '#c47a4a',
    alloy: '#d5dde8',
    fuel: '#e0b565',
    food: '#d08a3a',
    meds: '#3ecf9a',
    plates: '#7eb6ff',
    cells: '#ff6b5a',
    pearl: '#f3d2e4',
    water: '#49b6ff',
    data: '#c86bff',
    drones: '#e15a3a',
    iso: '#5ec8ff',
  };
  ctx.fillStyle = colors[goodId] ?? '#e0b565';
  ctx.beginPath();
  if (goodId === 'water' || goodId === 'fuel') ctx.ellipse(s / 2, s / 2, s * 0.22, s * 0.32, 0, 0, Math.PI * 2);
  else if (goodId === 'data') {
    ctx.rect(s * 0.22, s * 0.2, s * 0.56, s * 0.16);
    ctx.rect(s * 0.22, s * 0.42, s * 0.56, s * 0.16);
    ctx.rect(s * 0.22, s * 0.64, s * 0.4, s * 0.16);
  } else ctx.moveTo(s / 2, s * 0.18), ctx.lineTo(s * 0.82, s * 0.78), ctx.lineTo(s * 0.18, s * 0.78);
  ctx.fill();
  ctx.strokeStyle = 'rgba(224,181,101,.6)';
  ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
}

export function drawModuleIcon(canvas: HTMLCanvasElement, slot: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = '#101826';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = slot === 'high' ? '#ffb15a' : slot === 'mid' ? '#49b6ff' : slot === 'low' ? '#e0a15c' : '#c86bff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s * 0.2, s * 0.75);
  ctx.lineTo(s * 0.5, s * 0.2);
  ctx.lineTo(s * 0.8, s * 0.75);
  ctx.closePath();
  ctx.stroke();
}

function drawEmblemMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, race: PlayableRace): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = FACTION_COLOR[race];
  ctx.fillStyle = FACTION_COLOR[race];
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (race === 'human') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.7, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.7, 0);
    ctx.closePath();
  } else if (race === 'kvissae') {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
  } else if (race === 'zhargi') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.8, r * 0.7);
    ctx.lineTo(-r * 0.8, r * 0.7);
  } else if (race === 'taeyori') {
    ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 1.5);
  } else {
    ctx.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
  }
  ctx.stroke();
  ctx.restore();
}

function shade(hex: string, delta: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const ch = (shift: number) => Math.max(0, Math.min(255, ((n >> shift) & 255) + delta));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
