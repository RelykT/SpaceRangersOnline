import { MODULE_BY_ID } from '../sim/content';
import { loadImage, ready } from './art';
import { getQuality } from './quality';
import { alphaAt, clampArc, loopT, rot, wave } from './rigmath';
import { LOOP_S, artRace, shipDef, turretFile, turretKnown, type ChainPart, type ShipDef, type SocketDef, type SpritePart } from './v10map';

const FAMILY: Record<string, string> = {
  igla: 'kinetic',
  igla2: 'kinetic',
  rels: 'rail',
  oskol: 'missile',
  luch: 'laser',
  korona: 'laser',
  zhar: 'thermal',
  zhar2: 'thermal',
  plazma: 'thermal',
};

const LOOK: Record<string, Record<string, string>> = {
  human: { kinetic: 'autocannon', rail: 'main', missile: 'missile', laser: 'laser', thermal: 'laser' },
  zhargi: { kinetic: 'massdriver', rail: 'massdriver', missile: 'mortar', laser: 'twin', thermal: 'flak' },
  kvissae: { kinetic: 'pulse', rail: 'lance', missile: 'missile', laser: 'lance', thermal: 'thermal' },
  teyori: { kinetic: 'twin', rail: 'lance', missile: 'missile', laser: 'lance', thermal: 'tk' },
  vireks: { kinetic: 'rail', rail: 'rail', missile: 'mine', laser: 'ion', thermal: 'ion' },
  omnir: { kinetic: 'spine', rail: 'maw', missile: 'spore', laser: 'spine', thermal: 'spore' },
};

export interface ShipPaint {
  faction: string;
  hullId: string;
  size: number;
  time: number;
  combat: boolean;
  weapons?: (string | null)[];
  /** Nose-relative aim in degrees. Omitted: turrets rest outward. */
  aimDeg?: number | null;
  /** Parallel to fitted guns: true while that socket is in the muzzle flash. */
  hot?: boolean[];
}

interface Xf {
  ax: number;
  ay: number;
  ang: number;
  ox: number;
  oy: number;
}

const tinted = new Map<string, HTMLCanvasElement>();

function tintMask(img: HTMLImageElement, color: [number, number, number]): HTMLCanvasElement | null {
  if (!ready(img)) return null;
  const key = `${img.src}|${color.join(',')}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  g.fillRect(0, 0, c.width, c.height);
  tinted.set(key, c);
  return c;
}

function blit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  pivotX: number,
  pivotY: number,
  x: number,
  y: number,
  angleDeg: number,
  dw: number,
  dh: number,
): void {
  if (!ready(img)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.drawImage(img, -pivotX, -pivotY, dw, dh);
  ctx.restore();
}

function fittedType(race: string, socket: SocketDef, weaponId: string | null): string {
  if (!weaponId) return socket.type;
  const family = FAMILY[weaponId];
  const look = family ? LOOK[race]?.[family] : undefined;
  if (look && turretKnown(race, look)) return look;
  return socket.type;
}

function gunIds(weapons: (string | null)[] | undefined): string[] {
  const out: string[] = [];
  for (const id of weapons ?? []) {
    if (id && MODULE_BY_ID[id]?.weapon) out.push(id);
  }
  return out;
}

function partState(part: SpritePart, t: number, d: number): Xf {
  const [da, dx, dy] = part.motion ? wave(part.motion, t) : [0, 0, 0];
  return {
    ax: (part.anchor_uv[0] - 0.5) * d,
    ay: (part.anchor_uv[1] - 0.5) * d,
    ang: part.rest_angle_deg + da,
    ox: dx * d,
    oy: dy * d,
  };
}

function drawSpritePart(ctx: CanvasRenderingContext2D, part: SpritePart, xf: Xf, d: number, low: boolean): void {
  const file = low && part.file_192 ? part.file_192 : part.file;
  const img = loadImage(`ships_v10/${file}`);
  const k = d / 512;
  blit(ctx, img, part.pivot_px[0] * k, part.pivot_px[1] * k, xf.ax + xf.ox, xf.ay + xf.oy, xf.ang, part.size_px[0] * k, part.size_px[1] * k);
}

function drawChain(ctx: CanvasRenderingContext2D, part: ChainPart, t: number, d: number): void {
  let ang = part.rest_angle_deg;
  let x = (part.anchor_uv[0] - 0.5) * d;
  let y = (part.anchor_uv[1] - 0.5) * d;
  const k = d / 512;
  for (const seg of part.segments) {
    ang += wave(seg.motion, t)[0];
    const img = loadImage(`ships_v10/${seg.file}`);
    blit(ctx, img, seg.pivot_px[0] * k, seg.pivot_px[1] * k, x, y, ang, seg.size_px[0] * k, seg.size_px[1] * k);
    const [dx, dy] = rot(0, seg.length * d, ang);
    x += dx;
    y += dy;
  }
}

function drawParts(ctx: CanvasRenderingContext2D, ship: ShipDef, layer: 'under' | 'over', t: number, d: number, low: boolean, xf: Map<string, Xf>): void {
  for (const part of ship.rig.parts) {
    if (part.layer !== layer) continue;
    if (part.kind === 'chain') {
      drawChain(ctx, part, t, d);
      continue;
    }
    const state = xf.get(part.name) ?? partState(part, t, d);
    xf.set(part.name, state);
    drawSpritePart(ctx, part, state, d, low);
  }
}

function socketPos(sk: SocketDef, d: number, xf: Map<string, Xf>): { x: number; y: number; extra: number } {
  let x = (sk.u - 0.5) * d;
  let y = (sk.v - 0.5) * d;
  if (sk.parent === 'hull') return { x, y, extra: 0 };
  const parent = xf.get(sk.parent);
  if (!parent) return { x, y, extra: 0 };
  const [rx, ry] = rot(x - parent.ax, y - parent.ay, parent.ang);
  x = parent.ax + parent.ox + rx;
  y = parent.ay + parent.oy + ry;
  return { x, y, extra: parent.ang };
}

function drawTurret(
  ctx: CanvasRenderingContext2D,
  ship: ShipDef,
  sk: SocketDef,
  d: number,
  low: boolean,
  xf: Map<string, Xf>,
  aim: number | null,
  type: string,
  hot: boolean,
): void {
  const at = socketPos(sk, d, xf);
  const [arcMin, arcMax] = sk.arc_deg;
  const localAim = aim == null ? sk.rest_angle_deg : clampArc(aim - at.extra, arcMin, arcMax);
  const ang = localAim + at.extra;
  const file = turretFile(ship.race, type, low);
  if (!file) return;
  const img = loadImage(`ships_v10/${file}`);
  if (!ready(img)) return;
  const side = Math.max(4, sk.turret_draw_size * d);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate((ang * Math.PI) / 180);
  if (hot && !low) {
    const halo = ship.turret_halo;
    ctx.save();
    ctx.filter = 'blur(1.4px)';
    ctx.globalAlpha = 0.22;
    if (halo) ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, -side / 2, -side / 2, side, side);
    ctx.restore();
  }
  ctx.drawImage(img, -side / 2, -side / 2, side, side);
  ctx.restore();
}

function drawTurrets(
  ctx: CanvasRenderingContext2D,
  ship: ShipDef,
  d: number,
  low: boolean,
  xf: Map<string, Xf>,
  aim: number | null,
  guns: string[],
  hot: boolean[],
  parentHull: boolean,
): void {
  ship.sockets.forEach((sk, index) => {
    const onHull = sk.parent === 'hull';
    if (onHull !== parentHull) return;
    drawTurret(ctx, ship, sk, d, low, xf, aim, fittedType(ship.race, sk, guns[index] ?? null), !!hot[index]);
  });
}

function paintGlow(ctx: CanvasRenderingContext2D, ship: ShipDef, d: number, low: boolean, t: number): void {
  const mask = loadImage(`ships_v10/${low ? ship.glow_192 : ship.glow_512}`);
  const tint = tintMask(mask, ship.rig.glow.color);
  if (!tint) return;
  const amp = Math.max(0, Math.min(1.4, alphaAt(ship.rig.glow.alpha, t)));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = amp;
  ctx.drawImage(tint, -d / 2, -d / 2, d, d);
  ctx.restore();
}

function paintCore(ctx: CanvasRenderingContext2D, ship: ShipDef, d: number, t: number): void {
  const core = ship.rig.core;
  if (!core) return;
  const amp = Math.max(0, alphaAt(core.alpha, t));
  const x = (core.u - 0.5) * d;
  const y = (core.v - 0.5) * d;
  const rad = Math.max(4, core.radius * d);
  const g = ctx.createRadialGradient(x, y, rad * 0.15, x, y, rad);
  g.addColorStop(0, `rgba(${core.color[0]},${core.color[1]},${core.color[2]},${Math.min(1, amp)})`);
  g.addColorStop(1, `rgba(${core.color[0]},${core.color[1]},${core.color[2]},0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintGlints(ctx: CanvasRenderingContext2D, ship: ShipDef, d: number, t: number): void {
  const glints = ship.rig.glints;
  if (!glints?.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#fff6d0';
  glints.forEach((g, i) => {
    const phase = i / glints.length;
    const delta = Math.abs(((t - phase + 1) % 1) - 0);
    const near = Math.min(delta, 1 - delta);
    if (near > 0.045) return;
    const a = 1 - near / 0.045;
    ctx.globalAlpha = a;
    const x = (g.u - 0.5) * d;
    const y = (g.v - 0.5) * d;
    const s = Math.max(2, g.size * d);
    ctx.fillRect(x - s, y - 0.6, s * 2, 1.2);
    ctx.fillRect(x - 0.6, y - s, 1.2, s * 2);
  });
  ctx.restore();
}

/** Draw one ship in local space: origin at center, nose toward -y. Returns false if the hull is not ready. */
export function paintShip(ctx: CanvasRenderingContext2D, paint: ShipPaint): boolean {
  const ship = shipDef(paint.faction, paint.hullId);
  if (!ship) return false;
  const low = getQuality().name === 'low';
  const d = paint.size;
  const base = loadImage(`ships_v10/${low ? ship.base_192 : ship.base_512}`);
  if (!ready(base)) return false;
  const speed = paint.combat && artRace(paint.faction) === 'omnir' ? 1.65 : 1;
  const t = loopT(paint.time, LOOP_S, speed);
  const xf = new Map<string, Xf>();
  for (const part of ship.rig.parts) {
    if (part.kind === 'sprite') xf.set(part.name, partState(part, t, d));
  }
  const guns = gunIds(paint.weapons);
  const hot = paint.hot ?? [];
  const aim = paint.aimDeg ?? null;
  drawParts(ctx, ship, 'under', t, d, low, xf);
  ctx.drawImage(base, -d / 2, -d / 2, d, d);
  drawTurrets(ctx, ship, d, low, xf, aim, guns, hot, true);
  drawParts(ctx, ship, 'over', t, d, low, xf);
  drawTurrets(ctx, ship, d, low, xf, aim, guns, hot, false);
  if (getQuality().glow) {
    paintGlow(ctx, ship, d, low, t);
    if (!low) {
      paintCore(ctx, ship, d, t);
      paintGlints(ctx, ship, d, t);
    }
  }
  return true;
}

export function nozzleLocal(faction: string, hullId: string): { x: number; y: number; r: number }[] {
  const ship = shipDef(faction, hullId);
  if (!ship?.nozzles.length) return [{ x: 0, y: 0.35, r: 0.02 }];
  return ship.nozzles.map((n) => ({ x: n.u - 0.5, y: n.v - 0.5, r: n.radius }));
}
