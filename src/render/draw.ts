import { FACTION_COLOR, MODULE_BY_ID } from '../sim/content';
import { computeFit } from '../sim/fitting';
import { Y_SQUASH, worldToScreen, type Camera } from '../input/pick';
import { unit } from '../sim/rng';
import type { FactionId, Pilot, World } from '../sim/types';
import { cover, hullScale, menuNebula, menuPlanet, planetImage, ready, ringImage, splashImage, stationImage, systemImage } from './art';
import { getQuality, type Quality } from './quality';
import { drawCraft, paintExhaust } from './ships';

export interface ShipSample {
  id: string;
  name: string;
  faction: FactionId;
  hullId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  shield: number;
  armor: number;
  hull: number;
  maxShield: number;
  maxArmor: number;
  maxHull: number;
  docked: boolean;
  jumping: boolean;
  systemId: string;
  combat: boolean;
  thrust: number;
  boost: boolean;
  modules: (string | null)[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: 'spark' | 'smoke' | 'chunk';
}

const particles: Particle[] = [];
let seenPing = -1;

interface Bolt {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  born: number;
  life: number;
  color: string;
  fx: string;
}

const bolts: Bolt[] = [];
const nebulaCache = new Map<string, HTMLCanvasElement>();
const starCache = new Map<string, HTMLCanvasElement>();

function q(): Quality {
  return getQuality();
}

function burst(x: number, y: number, color: string, count: number, speed: number): void {
  const cap = q().particles;
  for (let i = 0; i < count && particles.length < cap; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.7,
      max: 0.8,
      color,
      size: 1.5 + Math.random() * 3,
      kind: Math.random() > 0.75 ? 'chunk' : 'spark',
    });
  }
}

function stepParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
  }
}

function paintParticles(ctx: CanvasRenderingContext2D, cam: Camera): void {
  for (const p of particles) {
    const s = worldToScreen(cam, p.x, p.y);
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    if (p.kind === 'chunk') ctx.fillRect(s.x, s.y, p.size, p.size * 0.6);
    else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function backdrop(kind: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const key = `${q().name}|${kind}|${w}x${h}`;
  const hit = (kind.startsWith('star') ? starCache : nebulaCache).get(key);
  if (hit && hit.width === w) return hit;
  const c = document.createElement('canvas');
  c.width = Math.max(2, w);
  c.height = Math.max(2, h);
  paint(c.getContext('2d')!);
  (kind.startsWith('star') ? starCache : nebulaCache).set(key, c);
  return c;
}

function paintStars(ctx: CanvasRenderingContext2D, seed: number, parallax: number, cam: Camera): void {
  const layer = backdrop(`star${seed}${parallax}`, 512, 512, (g) => {
    const n = q().stars;
    for (let i = 0; i < n; i++) {
      const x = unit(seed, i, 1) * 512;
      const y = unit(seed, i, 2) * 512;
      const bright = unit(seed, i, 3);
      g.fillStyle = bright > 0.92 ? '#fff4d2' : '#d5e4ff';
      g.globalAlpha = 0.25 + bright * 0.7;
      g.fillRect(x, y, bright > 0.9 ? 2 : 1, bright > 0.9 ? 2 : 1);
    }
    g.globalAlpha = 1;
  });
  const ox = ((-cam.x * parallax) % 512 + 512) % 512;
  const oy = ((-cam.y * parallax) % 512 + 512) % 512;
  for (let x = -1; x <= cam.viewW / 512 + 1; x++) {
    for (let y = -1; y <= cam.viewH / 512 + 1; y++) ctx.drawImage(layer, ox + x * 512 - 512, oy + y * 512 - 512);
  }
}

function paintNebula(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  if (!q().nebula) return;
  const layer = backdrop(`neb${seed}`, 480, 270, (g) => {
    for (let i = 0; i < 5; i++) {
      const x = unit(seed, i, 4) * 480;
      const y = unit(seed, i, 5) * 270;
      const rad = 60 + unit(seed, i, 6) * 90;
      const hue = unit(seed, i, 7) * 360;
      const glow = g.createRadialGradient(x, y, 0, x, y, rad);
      glow.addColorStop(0, `hsla(${hue}, 55%, 46%, .45)`);
      glow.addColorStop(1, 'hsla(220, 40%, 10%, 0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
  });
  ctx.globalAlpha = 0.85;
  ctx.drawImage(layer, 0, 0, w, h);
  ctx.globalAlpha = 1;
}

export function paintFrame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#10182a');
  g.addColorStop(1, '#05070e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawSplash(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  const plate = splashImage();
  if (ready(plate)) cover(ctx, plate, w, h, -time * 18, 0);
  else paintFrame(ctx, w, h);
  paintStars(ctx, 11, 0.15, { x: time * 40, y: time * 8, zoom: 1, viewW: w, viewH: h });
  const fly = Math.min(1, time / 3.2);
  drawCraft(ctx, {
    id: 'splash',
    x: w * (0.18 + fly * 0.64),
    y: h * 0.42,
    heading: -0.15,
    faction: 'kvissae',
    hullId: 'klinok',
    size: Math.min(220, w * 0.22),
    time,
    combat: false,
    hullFrac: 1,
    shieldFrac: 1,
    flash: false,
    lightX: -40,
    lightY: -30,
    thrust: 0.85,
    boost: false,
  });
  paintExhaust(ctx);
  ctx.save();
  ctx.globalAlpha = Math.min(1, time * 0.8);
  ctx.fillStyle = '#e0b565';
  ctx.font = `700 ${Math.max(42, w * 0.08)}px Unbounded, Rubik, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('КРОМКА', w / 2, h * 0.78);
  ctx.font = '16px Rubik, sans-serif';
  ctx.fillStyle = '#b7d4ff';
  ctx.fillText('живой край', w / 2, h * 0.78 + 32);
  ctx.restore();
}

export function drawMenu(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  const nebula = menuNebula();
  if (ready(nebula)) cover(ctx, nebula, w, h, -((time * 14) % 80), Math.sin(time * 0.15) * 12);
  else paintFrame(ctx, w, h);
  paintStars(ctx, 4, 0.12, { x: time * 18, y: time * 4, zoom: 1, viewW: w, viewH: h });
  paintStars(ctx, 8, 0.4, { x: time * 46, y: time * 9, zoom: 1, viewW: w, viewH: h });
  const dust = q().name === 'low' ? 18 : 46;
  for (let i = 0; i < dust; i++) {
    const speed = 28 + (i % 7) * 14;
    const x = ((i * 97 + time * speed) % (w + 40)) - 20;
    const y = ((i * 53 + time * speed * 0.15) % h);
    ctx.globalAlpha = 0.25 + (i % 5) * 0.1;
    ctx.fillStyle = i % 4 === 0 ? '#e0b565' : '#d5e4ff';
    ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, 1);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 5; i++) {
    const ang = time * (0.12 + i * 0.02) + i * 1.3;
    const rad = 70 + i * 28;
    const x = w * 0.72 + Math.cos(ang) * rad * 0.9;
    const y = h * 0.42 + Math.sin(ang) * rad * 0.35;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + time);
    ctx.fillStyle = i % 2 ? '#8d7358' : '#c4aa86';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-4, 7);
    ctx.lineTo(-8, -2);
    ctx.lineTo(2, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const planet = menuPlanet();
  if (ready(planet)) {
    const pw = Math.min(420, w * 0.42);
    ctx.drawImage(planet, w * 0.58 + Math.sin(time * 0.12) * 16, h * 0.18 + Math.cos(time * 0.1) * 10, pw, pw);
  }
  const fly = (offset: number, speed: number, y: number, hull: string, faction: string, size: number) => {
    const x = ((time * speed + offset) % (w + 360)) - 220;
    drawCraft(ctx, {
      id: `menu-${faction}-${hull}`,
      x,
      y,
      heading: 0.05,
      faction,
      hullId: hull,
      size,
      time,
      combat: faction === 'omnir',
      hullFrac: 1,
      shieldFrac: 1,
      flash: false,
      lightX: -30,
      lightY: -20,
      thrust: 0.9,
      boost: hull === 'iskra',
    });
  };
  fly(40, 70, h * 0.26, 'iskra', 'human', 108);
  fly(320, 48, h * 0.62, 'oplot', 'zhargi', 168);
  fly(560, 58, h * 0.16, 'korob', 'kvissae', 140);
  fly(800, 36, h * 0.48, 'monolit', 'taeyori', 230);
  fly(1040, 64, h * 0.78, 'klinok', 'omnir', 120);
  paintExhaust(ctx);
}

export function drawHangar(ctx: CanvasRenderingContext2D, w: number, h: number, owner: FactionId, time: number, hullId = 'iskra', modules?: (string | null)[]): void {
  const plate = stationImage(owner);
  if (ready(plate)) cover(ctx, plate, w, h, 0, 0);
  else {
    ctx.fillStyle = '#121a28';
    ctx.fillRect(0, 0, w, h);
  }
  const size = Math.min(h * 0.96, w * 0.62) * (0.55 + 0.45 * (hullScale(hullId) / 3.8));
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.56, size * 0.55, size * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  drawCraft(ctx, {
    id: `hangar-${owner}`,
    x: w * 0.5,
    y: h * 0.56,
    heading: -Math.PI / 2 + Math.sin(time * 0.25) * 0.04,
    faction: owner === 'free' || owner === 'pirate' ? 'human' : owner,
    hullId,
    size,
    time,
    combat: false,
    hullFrac: 1,
    shieldFrac: 1,
    flash: false,
    weapons: modules,
    lightX: 0,
    lightY: -1,
    thrust: 0.15,
    boost: false,
  });
  paintExhaust(ctx);
}

export function drawSystem(
  ctx: CanvasRenderingContext2D,
  world: World,
  cam: Camera,
  selectedId: string | null,
  ships: ShipSample[],
  now: number,
): void {
  const qual = q();
  const w = cam.viewW;
  const h = cam.viewH;
  const sys = world.systems.find((s) => s.id === world.player.systemId);
  const plate = systemImage(sys?.star ?? 'yellow');
  if (ready(plate)) cover(ctx, plate, w, h, -((cam.x * 0.02) % 120), -((cam.y * 0.02) % 80));
  else {
    paintFrame(ctx, w, h);
    paintNebula(ctx, w, h, (world.seed + (sys?.hue ?? 0) * 10) | 0);
  }
  paintStars(ctx, world.seed + 3, 0.2, cam);
  paintStars(ctx, world.seed + 9, 0.55, cam);
  if (!sys) return;
  if (world.player.jump) {
    drawTunnel(ctx, w, h, world.player.jump.progress, now);
    return;
  }
  const star = worldToScreen(cam, 0, 0);
  const starColor = sys.star === 'red' ? '#ff6a4a' : sys.star === 'blue' ? '#8ecbff' : sys.star === 'white' ? '#f7fbff' : sys.star === 'orange' ? '#ffb15a' : '#ffd27a';
  const glow = ctx.createRadialGradient(star.x, star.y, 4, star.x, star.y, 90 + 80 * cam.zoom);
  glow.addColorStop(0, '#fff');
  glow.addColorStop(0.18, starColor);
  glow.addColorStop(0.45, starColor);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(star.x, star.y, 160, 0, Math.PI * 2);
  ctx.fill();
  if (qual.glow) {
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath();
    ctx.moveTo(star.x - 70, star.y);
    ctx.lineTo(star.x + 70, star.y);
    ctx.moveTo(star.x, star.y - 46);
    ctx.lineTo(star.x, star.y + 46);
    ctx.stroke();
  }
  if (sys.belt) {
    const rocks = qual.rocks;
    for (let i = 0; i < rocks; i++) {
      const a = (i / rocks) * Math.PI * 2 + now * 0.02;
      const rad = sys.belt + Math.sin(i * 2.1) * 80;
      const p = worldToScreen(cam, Math.cos(a) * rad, Math.sin(a) * rad);
      ctx.fillStyle = i % 3 ? '#8a7560' : '#c2aa8a';
      ctx.fillRect(p.x, p.y, 3 + (i % 3), 2 + (i % 2));
    }
  }
  for (const gate of sys.gates) {
    const p = worldToScreen(cam, gate.x, gate.y);
    const other = world.systems.find((s) => s.id === gate.to);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = FACTION_COLOR[other?.owner ?? 'free'];
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = qual.glow ? 12 : 0;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 10, now * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d5e2f2';
    ctx.font = '12px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(other?.name ?? 'врата', 0, -22);
    ctx.restore();
  }
  for (const id of sys.planetIds) {
    const planet = world.planets.find((p) => p.id === id);
    if (!planet) continue;
    const p = worldToScreen(cam, planet.x, planet.y);
    const rad = Math.max(14, planet.radius * cam.zoom);
    drawPlanet(ctx, planet.id, planet.type, p.x, p.y, rad, now * planet.spin, qual.glow);
    if (selectedId === planet.id) bracket(ctx, p.x, p.y, rad + 8, '#e0b565');
    ctx.fillStyle = '#d5e2f2';
    ctx.font = '13px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(planet.name, p.x, p.y + rad + 16);
  }
  for (const id of sys.stationIds) {
    const st = world.stations.find((s) => s.id === id);
    if (!st) continue;
    const p = worldToScreen(cam, st.x, st.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#0e1624';
    ctx.strokeStyle = FACTION_COLOR[st.owner];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + now * 0.15;
      ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (selectedId === st.id) bracket(ctx, p.x, p.y, 18, FACTION_COLOR[st.owner]);
  }
  for (const wreck of world.wrecks) {
    if (wreck.systemId !== sys.id) continue;
    const p = worldToScreen(cam, wreck.x, wreck.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(wreck.x * 0.02);
    ctx.fillStyle = '#6e6258';
    ctx.fillRect(-8, -3, 11, 5);
    ctx.fillRect(3, 2, 7, 4);
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(-3, -7, 5, 4);
    ctx.restore();
    if (selectedId === wreck.id) bracket(ctx, p.x, p.y, 16, '#e0b565');
  }
  const dt = 0.016;
  stepParticles(dt);
  for (const ship of ships) {
    if (ship.systemId !== world.player.systemId || ship.docked || ship.jumping) continue;
    const p = worldToScreen(cam, ship.x, ship.y);
    const ang = Math.atan2(ship.vy, ship.vx);
    const faction = ship.id === 'player' ? (world.player.origin?.race ?? 'human') : ship.faction;
    const color = ship.id === 'player' ? '#9fd4ff' : FACTION_COLOR[ship.faction];
    const zoomBoost = Math.max(0.75, Math.min(2.2, cam.zoom / 0.5));
    const base = qual.name === 'low' ? 56 : qual.name === 'high' ? 84 : 72;
    const size = base * hullScale(ship.hullId) * zoomBoost * (ship.id === 'player' ? 1.06 : 1);
    const star = worldToScreen(cam, 0, 0);
    const aim = aimScreen(world, cam, ship);
    const hit = shieldHit(world, ship);
    drawCraft(ctx, {
      id: ship.id,
      x: p.x,
      y: p.y,
      heading: ang,
      faction,
      hullId: ship.hullId,
      size,
      time: now,
      combat: ship.combat,
      hullFrac: ship.hull / ship.maxHull,
      shieldFrac: ship.shield / ship.maxShield,
      flash: false,
      lightX: star.x - p.x,
      lightY: star.y - p.y,
      thrust: ship.thrust,
      boost: ship.boost,
      weapons: ship.modules,
      aimX: aim?.x,
      aimY: aim?.y,
      ripple: hit.ripple,
      rippleAng: hit.ang,
    });
    bars(ctx, p.x, p.y - size * 0.45, ship);
    if (selectedId === ship.id) bracket(ctx, p.x, p.y, size * 0.45, color);
  }
  paintExhaust(ctx);
  for (const ping of world.pings) {
    if (ping.time <= seenPing || ping.systemId !== sys.id) continue;
    if (ping.kind === 'explode') burst(ping.x, ping.y, '#ffb15a', qual.name === 'low' ? 10 : 22, 240);
    else if (ping.kind === 'hit') {
      burst(ping.x, ping.y, ping.color, qual.name === 'low' ? 3 : 6, 90);
      if (ping.fromX != null && ping.fromY != null) {
        bolts.push({
          x0: ping.fromX,
          y0: ping.fromY,
          x1: ping.x,
          y1: ping.y,
          born: ping.time,
          life: ping.fx === 'missile' ? 0.7 : 0.45,
          color: ping.color,
          fx: ping.fx ?? 'laser',
        });
      }
    }
  }
  const newest = world.pings[world.pings.length - 1]?.time ?? seenPing;
  if (newest > seenPing) seenPing = newest;
  paintBolts(ctx, cam, world.time);
  paintParticles(ctx, cam);
}

function aimScreen(world: World, cam: Camera, ship: ShipSample): { x: number; y: number } | null {
  if (!ship.combat) return null;
  let id: string | null = null;
  if (ship.id === 'player') {
    const sel = world.player.selectedId;
    if (sel && world.pilots.some((p) => p.id === sel && !p.destroyed && !p.dockedAt)) id = sel;
    else id = world.player.locked.find((lock) => world.pilots.some((p) => p.id === lock && !p.destroyed)) ?? null;
  } else {
    id = world.pilots.find((p) => p.id === ship.id)?.ai.targetId ?? null;
  }
  if (!id) return null;
  if (id === 'player') return worldToScreen(cam, world.player.x, world.player.y);
  const pilot = world.pilots.find((p) => p.id === id);
  if (!pilot || pilot.destroyed || pilot.dockedAt || pilot.systemId !== ship.systemId) return null;
  return worldToScreen(cam, pilot.x, pilot.y);
}

function shieldHit(world: World, ship: ShipSample): { ripple: number; ang: number } {
  let ripple = 0;
  let ang = 0;
  for (const ping of world.pings) {
    if (ping.kind !== 'hit' || ping.systemId !== ship.systemId) continue;
    const age = world.time - ping.time;
    if (age < 0 || age > 0.26) continue;
    if (Math.hypot(ping.x - ship.x, ping.y - ship.y) > 120) continue;
    const k = 1 - age / 0.26;
    if (k > ripple) {
      ripple = k;
      ang = ping.fromX == null ? 0 : Math.atan2((ping.fromY ?? ship.y) - ship.y, ping.fromX - ship.x);
    }
  }
  return { ripple, ang };
}

function paintBolts(ctx: CanvasRenderingContext2D, cam: Camera, time: number): void {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]!;
    const age = time - b.born;
    if (age < 0 || age > b.life) {
      if (age > b.life) bolts.splice(i, 1);
      continue;
    }
    const k = 1 - age / b.life;
    const a = worldToScreen(cam, b.x0, b.y0);
    const c = worldToScreen(cam, b.x1, b.y1);
    const u = Math.min(1, age / (b.life * 0.55));
    const hx = a.x + (c.x - a.x) * u;
    const hy = a.y + (c.y - a.y) * u;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0.15, k);
    if (b.fx === 'plasma') {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(hx, hy, 3.5 + Math.sin(age * 48) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.fx === 'slug') {
      ctx.strokeStyle = '#f4f0e4';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx - (c.x - a.x) * 0.08, hy - (c.y - a.y) * 0.08);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    } else if (b.fx === 'missile') {
      ctx.fillStyle = b.color;
      ctx.fillRect(hx - 2, hy - 2, 4, 4);
      ctx.globalAlpha = 0.35 * k;
      ctx.fillStyle = '#9aa0a8';
      ctx.beginPath();
      ctx.arc(a.x + (hx - a.x) * 0.6, a.y + (hy - a.y) * 0.6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.fx === 'spore') {
      ctx.fillStyle = '#d6ff6a';
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff3355';
      ctx.beginPath();
      ctx.arc(hx, hy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.fx === 'lance' ? 3.4 : b.fx === 'ion' ? 2.2 : 1.8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8 * k;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPlanet(ctx: CanvasRenderingContext2D, id: string, type: string, x: number, y: number, rad: number, spin: number, glow: boolean): void {
  const photo = planetImage(type);
  if (ready(photo)) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin * 0.15);
    ctx.drawImage(photo, -rad, -rad, rad * 2, rad * 2);
    if ((type === 'gas' || type === 'ice') && glow) {
      const ring = ringImage();
      if (ready(ring)) ctx.drawImage(ring, -rad * 1.7, -rad * 0.55, rad * 3.4, rad * 1.1);
    }
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.clip();
    const light = ctx.createRadialGradient(-rad * 0.35, -rad * 0.35, rad * 0.1, 0, 0, rad);
    light.addColorStop(0, 'rgba(255,255,255,.28)');
    light.addColorStop(0.6, 'rgba(255,255,255,0)');
    light.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = light;
    ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
    ctx.restore();
    return;
  }
  const sheet = planetSheet(id, type, spin, glow);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.clip();
  const shift = (spin * 40) % (rad * 2);
  ctx.drawImage(sheet, x - rad * 2 - shift, y - rad, rad * 4, rad * 2);
  const light = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
  light.addColorStop(0, 'rgba(255,255,255,.35)');
  light.addColorStop(0.55, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = light;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  ctx.restore();
  if (glow) {
    ctx.strokeStyle = 'rgba(180,220,255,.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, rad + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (type === 'gas' || type === 'ice') {
    ctx.strokeStyle = 'rgba(220,230,240,.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, rad * 1.6, rad * 0.28, -0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

const planetSheets = new Map<string, HTMLCanvasElement>();

function planetSheet(id: string, type: string, seed: number, detailed: boolean): HTMLCanvasElement {
  const key = `${id}:${type}:${detailed ? 1 : 0}`;
  const hit = planetSheets.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const palette: Record<string, [string, string, string]> = {
    volcanic: ['#3a120e', '#c4512a', '#ffb15a'],
    ocean: ['#0c2744', '#1f6fb5', '#b7e6ff'],
    barren: ['#3a3228', '#a08a68', '#e6d2a8'],
    ice: ['#9bb4c9', '#e7f3fb', '#ffffff'],
    gas: ['#6a4a22', '#e0b15a', '#fff0c2'],
    garden: ['#16351f', '#3e9a4c', '#d6ee8a'],
    hive: ['#3a2a18', '#c47a32', '#f0c27a'],
  };
  const [dark, mid, light] = palette[type] ?? palette.barren!;
  g.fillStyle = mid;
  g.fillRect(0, 0, 256, 128);
  const blobs = detailed ? 28 : 12;
  for (let i = 0; i < blobs; i++) {
    g.fillStyle = unit(seed + id.length, i, 2) > 0.5 ? light : dark;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.ellipse(unit(seed, i, 3) * 256, unit(seed, i, 4) * 128, 10 + unit(seed, i, 5) * 36, 6 + unit(seed, i, 6) * 14, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  if (type === 'gas') {
    for (let b = 0; b < 7; b++) {
      g.fillStyle = b % 2 ? 'rgba(255,255,255,.2)' : 'rgba(80,40,10,.28)';
      g.fillRect(0, 8 + b * 16, 256, 8);
    }
  }
  planetSheets.set(key, c);
  return c;
}

function drawTunnel(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number, now: number): void {
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  const streaks = q().name === 'low' ? 18 : 46;
  for (let i = 0; i < streaks; i++) {
    const a = (i / streaks) * Math.PI * 2 + now * 0.4;
    const inner = 16 + progress * 30;
    const outer = 90 + (i % 7) * 28 + progress * 260;
    ctx.strokeStyle = i % 2 ? 'rgba(224,181,101,.75)' : 'rgba(120,190,255,.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.fillStyle = '#e7eef8';
  ctx.font = '16px Rubik, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Гиперканал', 0, 6);
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fillRect(-90, 18, 180, 8);
  ctx.fillStyle = '#e0b565';
  ctx.fillRect(-90, 18, 180 * Math.max(0, Math.min(1, progress)), 8);
  ctx.restore();
}

export function drawMap(ctx: CanvasRenderingContext2D, world: World, cam: Camera, selectedId: string | null, now: number): void {
  const w = cam.viewW;
  const h = cam.viewH;
  const plate = menuNebula();
  if (ready(plate)) cover(ctx, plate, w, h, 0, 0);
  else paintFrame(ctx, w, h);
  paintNebula(ctx, w, h, world.seed);
  paintStars(ctx, world.seed, 0.12, cam);
  const drawn = new Set<string>();
  for (const sys of world.systems) {
    for (const to of sys.links) {
      const key = [sys.id, to].sort().join(':');
      if (drawn.has(key)) continue;
      drawn.add(key);
      const other = world.systems.find((s) => s.id === to);
      if (!other) continue;
      const a = worldToScreen(cam, sys.x, sys.y);
      const b = worldToScreen(cam, other.x, other.y);
      const onRoute = !!(world.player.route?.includes(sys.id) && world.player.route.includes(to));
      ctx.strokeStyle = onRoute ? 'rgba(224,181,101,.95)' : 'rgba(150,180,220,.28)';
      ctx.lineWidth = onRoute ? 2.4 : 1;
      ctx.setLineDash(onRoute ? [6, 6] : []);
      ctx.lineDashOffset = onRoute ? -now * 24 : 0;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (const sys of world.systems) {
    const p = worldToScreen(cam, sys.x, sys.y);
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sys.home ? 18 : 12);
    glow.addColorStop(0, FACTION_COLOR[sys.owner]);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, sys.home ? 18 : 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, sys.home ? 3.5 : 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (sys.id === world.player.systemId) {
      ctx.strokeStyle = '#9fd4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12 + Math.sin(now * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (sys.id === selectedId) bracket(ctx, p.x, p.y, 14, '#e0b565');
    ctx.fillStyle = '#d5e2f2';
    ctx.font = '12px Rubik, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(sys.name, p.x + 10, p.y - 8);
  }
  if (world.player.jump) {
    const from = world.systems.find((s) => s.id === world.player.jump!.from);
    const to = world.systems.find((s) => s.id === world.player.jump!.to);
    if (from && to) {
      const a = worldToScreen(cam, from.x, from.y);
      const b = worldToScreen(cam, to.x, to.y);
      const t = world.player.jump.progress;
      drawCraft(ctx, {
        id: 'map-player',
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        heading: Math.atan2(b.y - a.y, b.x - a.x),
        faction: world.player.origin?.race ?? 'human',
        hullId: world.player.ship.hullId,
        size: 48,
        time: now,
        combat: false,
        hullFrac: 1,
        shieldFrac: 1,
        flash: false,
        lightX: 0,
        lightY: -1,
        thrust: 1,
        boost: true,
      });
      paintExhaust(ctx);
    }
  }
}

function bars(ctx: CanvasRenderingContext2D, x: number, y: number, ship: ShipSample): void {
  const w = 32;
  const layers: [number, number, string][] = [
    [ship.shield, ship.maxShield, '#49b6ff'],
    [ship.armor, ship.maxArmor, '#e0a15c'],
    [ship.hull, ship.maxHull, '#e7eef8'],
  ];
  layers.forEach((layer, i) => {
    const [cur, max, color] = layer;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(x - w / 2, y + i * 3, w, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y + i * 3, w * (max > 0 ? Math.max(0, cur) / max : 0), 2);
  });
}

function bracket(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const c = r * 0.55;
  ctx.beginPath();
  ctx.moveTo(x - r, y - c);
  ctx.lineTo(x - r, y - r);
  ctx.lineTo(x - c, y - r);
  ctx.moveTo(x + c, y - r);
  ctx.lineTo(x + r, y - r);
  ctx.lineTo(x + r, y - c);
  ctx.moveTo(x - r, y + c);
  ctx.lineTo(x - r, y + r);
  ctx.lineTo(x - c, y + r);
  ctx.moveTo(x + c, y + r);
  ctx.lineTo(x + r, y + r);
  ctx.lineTo(x + r, y + c);
  ctx.stroke();
}

export function pilotSamples(world: World, pos: (id: string, x: number, y: number) => { x: number; y: number }): ShipSample[] {
  const out: ShipSample[] = [];
  const push = (id: string, name: string, faction: FactionId, hullId: string, systemId: string, x: number, y: number, vx: number, vy: number, ship: Pilot['ship'], docked: boolean, jumping: boolean, combat: boolean) => {
    const at = pos(id, x, y);
    const fit = computeFit(ship);
    const boost = ship.modules.some((id, i) => !!id && ship.online[i] && !!MODULE_BY_ID[id]?.mwd);
    const thrust = Math.min(1, Math.hypot(vx, vy) / Math.max(80, fit.speed));
    out.push({
      id, name, faction, hullId, systemId,
      x: at.x, y: at.y, vx, vy,
      shield: ship.shield, armor: ship.armor, hull: ship.hull,
      maxShield: Math.max(1, fit.maxShield), maxArmor: Math.max(1, fit.maxArmor), maxHull: Math.max(1, fit.maxHull),
      docked, jumping, combat, thrust, boost, modules: ship.modules,
    });
  };
  const player = world.player;
  push('player', player.name, 'free', player.ship.hullId, player.systemId, player.x, player.y, player.vx, player.vy, player.ship, !!player.dockedAt, !!player.jump, player.combatTimer > 0);
  for (const pilot of world.pilots) {
    if (pilot.destroyed) continue;
    push(pilot.id, pilot.name, pilot.faction, pilot.ship.hullId, pilot.systemId, pilot.x, pilot.y, pilot.vx, pilot.vy, pilot.ship, !!pilot.dockedAt, !!pilot.jump, pilot.combatTimer > 0);
  }
  return out;
}

export { Y_SQUASH };
