import { crowdRadius } from './content';
import { clamp } from './rng';
import { dist, systemById } from './query';
import type { Body, NavMode, World } from './types';

export function jumpDuration(world: World, fromId: string, toId: string): number {
  const a = systemById(world, fromId);
  const b = systemById(world, toId);
  if (!a || !b) return 10;
  return clamp(7, 16, dist(a.x, a.y, b.x, b.y) / 42);
}

function approach(cur: number, goal: number, maxDelta: number): number {
  const d = goal - cur;
  if (Math.abs(d) <= maxDelta) return goal;
  return cur + Math.sign(d) * maxDelta;
}

function desiredVelocity(
  mode: NavMode,
  x: number,
  y: number,
  vx: number,
  vy: number,
  tx: number,
  ty: number,
  range: number,
  maxSpd: number,
): { x: number; y: number } {
  if (mode === 'stop') return { x: 0, y: 0 };
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const nx = dx / d;
  const ny = dy / d;
  if (mode === 'approach') {
    if (d <= Math.max(8, range)) return { x: 0, y: 0 };
    return { x: nx * maxSpd, y: ny * maxSpd };
  }
  if (mode === 'keep') {
    const err = d - range;
    if (Math.abs(err) < 50) return { x: -ny * maxSpd * 0.12, y: nx * maxSpd * 0.12 };
    const dir = err > 0 ? 1 : -1;
    return { x: nx * maxSpd * dir, y: ny * maxSpd * dir };
  }
  const err = d - range;
  const txu = -ny;
  const tyu = nx;
  const side = vx * txu + vy * tyu >= 0 ? 1 : -1;
  const radial = clamp(err * 0.85, -maxSpd, maxSpd);
  const tang = maxSpd * clamp(1 - Math.abs(err) / Math.max(80, range), 0.4, 1);
  return { x: nx * radial + txu * side * tang, y: ny * radial + tyu * side * tang };
}

export function updateMotion(world: World, body: Body, dt: number, scrammed: boolean, speedMult: number, maxSpeed: number, mass: number): void {
  if (body.dockedAt) {
    body.vx = 0;
    body.vy = 0;
    body.warp = null;
    return;
  }
  if (body.jump) {
    body.jump.progress += dt / body.jump.duration;
    body.vx = 0;
    body.vy = 0;
    body.warp = null;
    if (body.jump.progress >= 1) {
      const to = body.jump.to;
      const sys = systemById(world, to);
      const gate = sys?.gates.find((g) => g.to === body.jump!.from);
      body.systemId = to;
      body.x = gate ? gate.x * 0.86 : 400;
      body.y = gate ? gate.y * 0.86 : 0;
      body.jump = null;
      body.combatTimer = 0;
    }
    return;
  }
  if (body.docking) {
    body.docking.t += dt;
    body.vx *= 0.9;
    body.vy *= 0.9;
    return;
  }

  const dx = body.nav.x - body.x;
  const dy = body.nav.y - body.y;
  const d = Math.hypot(dx, dy);
  const canWarp = !scrammed && body.combatTimer <= 0 && body.nav.mode === 'approach' && !body.nav.followId;
  if (!body.warp && canWarp && d > 2300) {
    body.warp = { phase: 'align', t: 0, x: body.nav.x, y: body.nav.y };
  }
  if (body.warp && (!canWarp || dist(body.warp.x, body.warp.y, body.nav.x, body.nav.y) > 400)) {
    body.warp = null;
  }
  if (body.warp) {
    body.warp.t += dt;
    const wx = body.warp.x - body.x;
    const wy = body.warp.y - body.y;
    const wd = Math.hypot(wx, wy) || 1;
    if (body.warp.phase === 'align') {
      const spd = maxSpeed * speedMult;
      body.vx = approach(body.vx, (wx / wd) * spd, 400 * dt);
      body.vy = approach(body.vy, (wy / wd) * spd, 400 * dt);
      if (body.warp.t > 1.15) body.warp.phase = 'cruise';
    } else {
      if (wd < 380) body.warp = null;
      else {
        const cruise = 2400;
        body.vx = (wx / wd) * cruise;
        body.vy = (wy / wd) * cruise;
      }
    }
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    return;
  }

  const spd = maxSpeed * speedMult;
  const goal = desiredVelocity(body.nav.mode, body.x, body.y, body.vx, body.vy, body.nav.x, body.nav.y, body.nav.range, spd);
  const accel = 240 / Math.max(0.6, mass);
  body.vx = approach(body.vx, goal.x, accel * dt);
  body.vy = approach(body.vy, goal.y, accel * dt);
  const sp = Math.hypot(body.vx, body.vy);
  if (sp > spd && sp > 0) {
    body.vx *= spd / sp;
    body.vy *= spd / sp;
  }
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  const r = Math.hypot(body.x, body.y);
  if (r > 9200) {
    body.x *= 9200 / r;
    body.y *= 9200 / r;
  }
}

export function separateBodies(list: Body[]): void {
  const ordered = [...list].sort((a, b) => (a.id < b.id ? -1 : 1));
  const push = new Map<string, { x: number; y: number }>();
  for (const b of ordered) push.set(b.id, { x: 0, y: 0 });
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i]!;
      const b = ordered[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const need = crowdRadius(a.ship.hullId) + crowdRadius(b.ship.hullId);
      if (d >= need || d < 0.001) continue;
      const overlap = (need - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      push.get(a.id)!.x -= nx * overlap;
      push.get(a.id)!.y -= ny * overlap;
      push.get(b.id)!.x += nx * overlap;
      push.get(b.id)!.y += ny * overlap;
    }
  }
  for (const b of ordered) {
    const p = push.get(b.id)!;
    b.x += p.x;
    b.y += p.y;
  }
}
