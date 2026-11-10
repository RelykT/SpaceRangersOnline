import { computeFit } from './fitting';
import { clamp } from './rng';
import { dist, findBody } from './query';
import { DAMAGE_TYPES, type Body, DamageType, FitStats, ShipInstance, World } from './types';

export function rangeFactor(distance: number, optimal: number, falloff: number): number {
  if (distance <= optimal) return 1;
  if (falloff <= 1) return 0;
  return clamp(1 - (distance - optimal) / falloff, 0, 1);
}

export function transversal(
  ax: number,
  ay: number,
  avx: number,
  avy: number,
  bx: number,
  by: number,
  bvx: number,
  bvy: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy) || 1;
  const rx = bvx - avx;
  const ry = bvy - avy;
  const nx = dx / d;
  const ny = dy / d;
  const radial = rx * nx + ry * ny;
  return Math.hypot(rx - radial * nx, ry - radial * ny);
}

/** 0 outside falloff, about 1 on a slow target inside optimal. */
export function application(
  distance: number,
  optimal: number,
  falloff: number,
  tracking: number,
  signature: number,
  trans: number,
): number {
  const range = rangeFactor(distance, optimal, falloff);
  if (range <= 0) return 0;
  const ang = trans / Math.max(140, distance);
  const sigFactor = clamp(signature / 42, 0.45, 2.2);
  const need = ang / Math.max(0.05, tracking * sigFactor);
  const track = clamp(1.2 - need * 0.5, 0.22, 1);
  return range * track;
}

export function applyDamage(ship: ShipInstance, fit: FitStats, amount: number, type: DamageType, adapt = false): void {
  let left = Math.max(0, amount);
  const bonus = adapt ? ship.adapt?.[type] ?? 0 : 0;
  const soak = (layer: 'shield' | 'armor' | 'hull', resist: number) => {
    if (left <= 0) return;
    const hp = ship[layer];
    if (layer !== 'hull' && hp <= 0) return;
    const reduced = left * (1 - resist);
    if (layer === 'hull') {
      ship.hull = Math.max(0, hp - reduced);
      left = 0;
      return;
    }
    if (reduced <= hp) {
      ship[layer] = hp - reduced;
      left = 0;
      return;
    }
    const ratio = hp / Math.max(0.0001, reduced);
    ship[layer] = 0;
    left *= 1 - ratio;
  };
  if (ship.shield > 0) soak('shield', clamp(fit.shieldResist[type] + bonus, 0, 0.92));
  if (left > 0 && ship.armor > 0) soak('armor', clamp(fit.armorResist[type] + bonus * 0.65, 0, 0.92));
  if (left > 0) soak('hull', adapt ? bonus * 0.25 : 0);
  if (adapt && amount > 0) {
    const cur = ship.adapt ?? { em: 0, thermal: 0, kinetic: 0, explosive: 0 };
    cur[type] = Math.min(0.34, cur[type] + 0.05);
    for (const key of DAMAGE_TYPES) if (key !== type) cur[key] = Math.max(0, cur[key] - 0.012);
    ship.adapt = cur;
  }
}

export interface EwarState {
  web: number;
  scram: boolean;
  painter: number;
}

export function ewarAgainst(world: World, victimId: string): EwarState {
  const victim = findBody(world, victimId);
  if (!victim) return { web: 1, scram: false, painter: 1 };
  let web = 1;
  let scram = false;
  let painter = 1;
  const consider = (attacker: Body, engaged: boolean) => {
    if (!engaged || attacker.id === victim.id) return;
    if (attacker.dockedAt || attacker.jump || attacker.systemId !== victim.systemId) return;
    const d = dist(attacker.x, attacker.y, victim.x, victim.y);
    const fit = computeFit(attacker.ship);
    for (const e of fit.ewars) {
      if (!e.online) continue;
      const f = rangeFactor(d, e.optimal, e.falloff);
      if (f <= 0) continue;
      if (e.kind === 'web') web *= 1 - e.amount * f;
      else if (e.kind === 'scram') scram = true;
      else painter += e.amount * f;
    }
  };
  for (const p of world.pilots) {
    if (p.destroyed) continue;
    consider(p, p.ai.targetId === victimId);
  }
  consider(world.player, world.player.locked.includes(victimId));
  return { web: clamp(web, 0.18, 1), scram, painter };
}

export function lockSeconds(scanRes: number, signature: number): number {
  return clamp(0.45, 3.4, (980 / Math.max(40, scanRes)) * (46 / Math.max(18, signature)));
}
