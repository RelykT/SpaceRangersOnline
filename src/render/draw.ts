import { FACTION_COLOR, PLAYER_COLOR } from '../sim/content';
import { computeFit } from '../sim/fitting';
import { Y_SQUASH, worldToScreen, type Camera } from '../input/pick';
import { unit } from '../sim/rng';
import type { FactionId, Pilot, World } from '../sim/types';

export interface ShipSample {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hullId: string;
  faction: FactionId;
  shield: number;
  armor: number;
  hull: number;
  maxShield: number;
  maxArmor: number;
  maxHull: number;
  docked: boolean;
  jumping: boolean;
  name: string;
  systemId: string;
}

interface Star {
  x: number;
  y: number;
  z: number;
  r: number;
  a: number;
}

const starCache = new Map<number, Star[]>();
const planetCache = new Map<string, HTMLCanvasElement>();

function starsFor(seed: number): Star[] {
  const hit = starCache.get(seed);
  if (hit) return hit;
  const list: Star[] = [];
  for (let i = 0; i < 220; i++) {
    list.push({
      x: unit(seed, i, 1) * 4000 - 2000,
      y: unit(seed, i, 2) * 4000 - 2000,
      z: 0.15 + unit(seed, i, 3) * 0.85,
      r: unit(seed, i, 4) > 0.92 ? 1.6 : 0.8,
      a: 0.25 + unit(seed, i, 5) * 0.7,
    });
  }
  starCache.set(seed, list);
  return list;
}

const PLANET_COLORS: Record<string, [string, string, string]> = {
  volcanic: ['#3a1a14', '#c4512a', '#ffb15a'],
  ocean: ['#0c2744', '#1f6fb5', '#9fd4ff'],
  barren: ['#3a3228', '#a08a68', '#e6d2a8'],
  ice: ['#c5d4e4', '#f4fbff', '#8fb4d8'],
  gas: ['#6a4a22', '#e0b15a', '#f3dd9a'],
  garden: ['#16351f', '#3e9a4c', '#d8e38a'],
  hive: ['#3a2a18', '#c47a32', '#f0c27a'],
};

function planetSprite(id: string, type: string, seed: number): HTMLCanvasElement {
  const key = `${id}:${type}`;
  const cached = planetCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const [dark, mid, light] = PLANET_COLORS[type] ?? PLANET_COLORS.barren!;
  g.fillStyle = mid;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 18; i++) {
    const x = 20 + unit(seed, i, 8) * 88;
    const y = 16 + unit(seed, i, 9) * 96;
    const rw = 10 + unit(seed, i, 10) * 36;
    const rh = 6 + unit(seed, i, 11) * 16;
    g.fillStyle = unit(seed, i, 12) > 0.5 ? light : dark;
    g.globalAlpha = 0.45;
    g.beginPath();
    g.ellipse(x, y, rw, rh, unit(seed, i, 13) * 2, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  if (type === 'gas') {
    for (let b = 0; b < 6; b++) {
      g.fillStyle = b % 2 ? 'rgba(255,255,255,.18)' : 'rgba(80,40,10,.25)';
      g.fillRect(8, 18 + b * 16, 112, 8);
    }
  }
  const shade = g.createRadialGradient(46, 42, 8, 64, 64, 62);
  shade.addColorStop(0, 'rgba(255,255,255,.45)');
  shade.addColorStop(0.45, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = shade;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  planetCache.set(key, c);
  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function paintFrame(ctx: CanvasRenderingContext2D, w: number, h: number, color = '#070c16'): void {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  g.addColorStop(0, '#121a2c');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawMenu(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  paintFrame(ctx, w, h);
  drawStarLayer(ctx, w, h, 1, { x: Math.sin(time * 0.02) * 40, y: 0, zoom: 0.35, viewW: w, viewH: h }, 0.6);
  const cx = w * 0.5;
  const cy = h * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 180);
  glow.addColorStop(0, 'rgba(224,181,101,.35)');
  glow.addColorStop(1, 'rgba(224,181,101,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e7c27a';
  ctx.beginPath();
  ctx.arc(-20, -10, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,210,255,.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 10, 120, 28, -0.4, 0, Math.PI * 2);
  ctx.stroke();
  drawShipShape(ctx, 'iskra', 22, time * 0.4, PLAYER_COLOR, 90, 40);
  drawShipShape(ctx, 'klinok', 16, time * 0.6 + 2, FACTION_COLOR.regnar, -120, 70);
  ctx.restore();
}

function drawStarLayer(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, cam: Camera, parallax: number): void {
  ctx.fillStyle = '#d5e4ff';
  for (const s of starsFor(seed)) {
    const x = ((s.x - cam.x * parallax * s.z) % w + w) % w;
    const y = ((s.y - cam.y * parallax * s.z) % h + h) % h;
    ctx.globalAlpha = s.a * (0.4 + parallax);
    ctx.fillRect(x, y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

export function drawSystem(
  ctx: CanvasRenderingContext2D,
  world: World,
  cam: Camera,
  selectedId: string | null,
  ships: ShipSample[],
  now: number,
): void {
  const w = cam.viewW;
  const h = cam.viewH;
  const sys = world.systems.find((s) => s.id === world.player.systemId);
  paintFrame(ctx, w, h, sys?.owner === 'absolute' ? '#140814' : '#070c16');
  drawStarLayer(ctx, w, h, world.seed + 3, cam, 0.25);
  drawStarLayer(ctx, w, h, world.seed + 9, cam, 0.55);
  if (!sys) return;
  if (world.player.jump) {
    drawTunnel(ctx, w, h, world.player.jump.progress, now);
    return;
  }
  const star = worldToScreen(cam, 0, 0);
  const starColor = sys.star === 'red' ? '#ff6a4a' : sys.star === 'blue' ? '#8ecbff' : sys.star === 'white' ? '#f4f7ff' : sys.star === 'orange' ? '#ffb15a' : '#ffd27a';
  const glow = ctx.createRadialGradient(star.x, star.y, 8, star.x, star.y, 160 * cam.zoom + 80);
  glow.addColorStop(0, starColor);
  glow.addColorStop(0.2, starColor);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(star.x, star.y, 180, 0, Math.PI * 2);
  ctx.fill();
  if (sys.belt) {
    ctx.strokeStyle = 'rgba(180,160,120,.25)';
    ctx.lineWidth = 8;
    const belt = worldToScreen(cam, sys.belt, 0);
    const r = Math.abs(belt.x - star.x);
    ctx.beginPath();
    ctx.ellipse(star.x, star.y, r, r * Y_SQUASH, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const gate of sys.gates) {
    const p = worldToScreen(cam, gate.x, gate.y);
    const other = world.systems.find((s) => s.id === gate.to);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = FACTION_COLOR[other?.owner ?? 'free'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(16, 28 * cam.zoom), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(8, 14 * cam.zoom), now, now + 4);
    ctx.stroke();
    ctx.fillStyle = '#c9d7ea';
    ctx.font = '12px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(other?.name ?? 'врата', 0, -22);
    ctx.restore();
  }
  for (const id of sys.planetIds) {
    const planet = world.planets.find((p) => p.id === id);
    if (!planet) continue;
    const p = worldToScreen(cam, planet.x, planet.y);
    const rad = Math.max(10, planet.radius * cam.zoom);
    const sprite = planetSprite(planet.id, planet.type, world.seed + planet.name.length);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.clip();
    const shift = (now * planet.spin * 12) % (rad * 2);
    ctx.drawImage(sprite, p.x - rad - shift, p.y - rad, rad * 4, rad * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad + 2, 0, Math.PI * 2);
    ctx.stroke();
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
    ctx.fillStyle = '#101826';
    ctx.strokeStyle = FACTION_COLOR[st.owner];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + now * 0.2;
      const r = 11;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
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
    ctx.fillStyle = '#6e6258';
    ctx.fillRect(p.x - 5, p.y - 3, 10, 6);
    if (selectedId === wreck.id) bracket(ctx, p.x, p.y, 16, '#e0b565');
  }
  for (const ship of ships) {
    if (ship.systemId !== world.player.systemId || ship.docked || ship.jumping) continue;
    const p = worldToScreen(cam, ship.x, ship.y);
    const ang = Math.atan2(ship.vy, ship.vx);
    const color = ship.id === 'player' ? PLAYER_COLOR : FACTION_COLOR[ship.faction];
    const size = ship.id === 'player' ? 16 : 13;
    if (ship.id !== 'player') {
      ctx.strokeStyle = 'rgba(120,160,255,.15)';
      ctx.beginPath();
      ctx.moveTo(worldToScreen(cam, ship.x - ship.vx * 0.35, ship.y - ship.vy * 0.35).x, worldToScreen(cam, ship.x - ship.vx * 0.35, ship.y - ship.vy * 0.35).y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    drawShipShape(ctx, ship.hullId, size, ang, color, p.x, p.y);
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > 20) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      const flame = ctx.createLinearGradient(-size, 0, -size - 10 - speed * 0.02, 0);
      flame.addColorStop(0, 'rgba(120,190,255,.9)');
      flame.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(-size + 2, 0);
      ctx.lineTo(-size - 8 - (now * 40) % 6, 3);
      ctx.lineTo(-size - 8, -3);
      ctx.fill();
      ctx.restore();
    }
    bars(ctx, p.x, p.y - size - 10, ship);
    if (selectedId === ship.id) bracket(ctx, p.x, p.y, size + 8, color);
  }
  const player = ships.find((s) => s.id === 'player');
  if (player && selectedId && !world.player.dockedAt) {
    const target = ships.find((s) => s.id === selectedId);
    if (target) {
      const a = worldToScreen(cam, player.x, player.y);
      const b = worldToScreen(cam, target.x, target.y);
      ctx.strokeStyle = 'rgba(159,212,255,.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function bars(ctx: CanvasRenderingContext2D, x: number, y: number, ship: ShipSample): void {
  const w = 28;
  const layers: [number, number, string][] = [
    [ship.shield, ship.maxShield, '#49b6ff'],
    [ship.armor, ship.maxArmor, '#e0a15c'],
    [ship.hull, ship.maxHull, '#d5d8e0'],
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

function drawShipShape(ctx: CanvasRenderingContext2D, hullId: string, size: number, ang: number, color: string, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  if (hullId === 'korob') {
    ctx.rect(-size, -size * 0.55, size * 1.7, size * 1.1);
  } else if (hullId === 'monolit') {
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.2, size * 0.7);
    ctx.lineTo(-size, size * 0.35);
    ctx.lineTo(-size, -size * 0.35);
    ctx.lineTo(-size * 0.2, -size * 0.7);
  } else if (hullId === 'oplot') {
    ctx.moveTo(size, 0);
    ctx.lineTo(size * 0.2, size * 0.55);
    ctx.lineTo(-size, size * 0.35);
    ctx.lineTo(-size * 0.6, 0);
    ctx.lineTo(-size, -size * 0.35);
    ctx.lineTo(size * 0.2, -size * 0.55);
  } else if (hullId === 'klinok') {
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.1, size * 0.35);
    ctx.lineTo(-size * 0.8, size * 0.85);
    ctx.lineTo(-size, size * 0.2);
    ctx.lineTo(-size * 0.4, 0);
    ctx.lineTo(-size, -size * 0.2);
    ctx.lineTo(-size * 0.8, -size * 0.85);
    ctx.lineTo(-size * 0.1, -size * 0.35);
  } else {
    ctx.moveTo(size, 0);
    ctx.lineTo(-size, size * 0.62);
    ctx.lineTo(-size * 0.45, 0);
    ctx.lineTo(-size, -size * 0.62);
  }
  ctx.closePath();
  const grad = ctx.createLinearGradient(-size, -size, size, size);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, '#1a120c');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.stroke();
  ctx.restore();
}

function drawTunnel(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number, now: number): void {
  ctx.fillStyle = '#05060d';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + now;
    const inner = 20 + progress * 40;
    const outer = 80 + (i % 5) * 40 + progress * 220;
    ctx.strokeStyle = i % 2 ? 'rgba(224,181,101,.7)' : 'rgba(120,180,255,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.fillStyle = '#e7eef8';
  ctx.font = '16px Rubik, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Гиперканал', 0, 8);
  roundRect(ctx, -80, 24, 160, 8, 4);
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fill();
  roundRect(ctx, -80, 24, 160 * progress, 8, 4);
  ctx.fillStyle = '#e0b565';
  ctx.fill();
  ctx.restore();
}

export function drawMap(ctx: CanvasRenderingContext2D, world: World, cam: Camera, selectedId: string | null, now: number): void {
  const w = cam.viewW;
  const h = cam.viewH;
  paintFrame(ctx, w, h, '#081018');
  drawStarLayer(ctx, w, h, world.seed, cam, 0.15);
  for (const sys of world.systems) {
    const hue = sys.hue * 360;
    const p = worldToScreen(cam, sys.x, sys.y);
    const neb = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 70);
    neb.addColorStop(0, `hsla(${hue}, 40%, 40%, .18)`);
    neb.addColorStop(1, 'transparent');
    ctx.fillStyle = neb;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 70, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 1;
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
      const onRoute = world.player.route?.includes(sys.id) && world.player.route.includes(to);
      ctx.strokeStyle = onRoute ? 'rgba(224,181,101,.9)' : 'rgba(140,170,210,.28)';
      ctx.lineWidth = onRoute ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  for (const sys of world.systems) {
    const p = worldToScreen(cam, sys.x, sys.y);
    ctx.fillStyle = FACTION_COLOR[sys.owner];
    ctx.beginPath();
    ctx.arc(p.x, p.y, sys.home ? 7 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (sys.id === world.player.systemId) {
      ctx.strokeStyle = PLAYER_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11 + Math.sin(now * 3), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (sys.id === selectedId) bracket(ctx, p.x, p.y, 14, '#e0b565');
    ctx.fillStyle = '#d5e2f2';
    ctx.font = '12px Rubik, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(sys.name, p.x + 8, p.y - 8);
  }
  if (world.player.jump) {
    const from = world.systems.find((s) => s.id === world.player.jump!.from);
    const to = world.systems.find((s) => s.id === world.player.jump!.to);
    if (from && to) {
      const a = worldToScreen(cam, from.x, from.y);
      const b = worldToScreen(cam, to.x, to.y);
      const t = world.player.jump.progress;
      ctx.fillStyle = PLAYER_COLOR;
      ctx.beginPath();
      ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const pilot of world.pilots) {
    if (pilot.destroyed || pilot.jump || pilot.dockedAt) continue;
    const sys = world.systems.find((s) => s.id === pilot.systemId);
    if (!sys) continue;
    const jitter = ((pilot.id.charCodeAt(1) || 1) % 7) - 3;
    const p = worldToScreen(cam, sys.x + jitter * 4, sys.y + 10);
    ctx.fillStyle = FACTION_COLOR[pilot.faction];
    ctx.fillRect(p.x, p.y, 2, 2);
  }
}

export function pilotSamples(world: World, pos: (id: string, x: number, y: number) => { x: number; y: number }): ShipSample[] {
  const out: ShipSample[] = [];
  const push = (id: string, name: string, faction: FactionId, hullId: string, systemId: string, x: number, y: number, vx: number, vy: number, ship: Pilot['ship'], docked: boolean, jumping: boolean) => {
    const at = pos(id, x, y);
    const max = shipMax(ship);
    out.push({
      id,
      name,
      faction,
      hullId,
      x: at.x,
      y: at.y,
      vx,
      vy,
      shield: ship.shield,
      armor: ship.armor,
      hull: ship.hull,
      maxShield: max.shield,
      maxArmor: max.armor,
      maxHull: max.hull,
      docked,
      jumping,
      systemId,
    });
  };
  const player = world.player;
  push('player', player.name, 'free', player.ship.hullId, player.systemId, player.x, player.y, player.vx, player.vy, player.ship, !!player.dockedAt, !!player.jump);
  for (const pilot of world.pilots) {
    if (pilot.destroyed) continue;
    push(pilot.id, pilot.name, pilot.faction, pilot.ship.hullId, pilot.systemId, pilot.x, pilot.y, pilot.vx, pilot.vy, pilot.ship, !!pilot.dockedAt, !!pilot.jump);
  }
  return out;
}

function shipMax(ship: Pilot['ship']): { shield: number; armor: number; hull: number } {
  const fit = computeFit(ship);
  return { shield: Math.max(1, fit.maxShield), armor: Math.max(1, fit.maxArmor), hull: Math.max(1, fit.maxHull) };
}

export { Y_SQUASH };
