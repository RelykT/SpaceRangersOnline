import { absoluteReach, systemCount } from './origin';
import { LIVING_FACTIONS } from './types';
import type { FactionId, GalaxySettings, Planet, PlanetType, StarKind, StarSystem, Station, World } from './types';
import { makeMarket } from './economy';
import { clamp, mulberry32 } from './rng';

const A = ['Ка', 'Ве', 'Су', 'Та', 'Ио', 'Кве', 'Ор', 'Ми', 'Нэ', 'Гар', 'Уль', 'Пре', 'Ярь', 'Дэм', 'Хар', 'Зу', 'Ли', 'Ше', 'Ао', 'Фи', 'Ро', 'Но', 'Са', 'Кро', 'Ме', 'Ви', 'То', 'Эс', 'Ки', 'Ло'];
const B = ['ри', 'он', 'ль', 'ра', 'рн', 'ес', 'лла', 'ста', 'вин', 'рад', 'лос', 'то', 'са', 'нн', 'ост', 'ул', 'но', 'кт', 'ви', 'дан', 'тес', 'кор', 'вэн', 'ши', 'ос', 'ар', 'ин', 'ум', 'мир', 'рок'];
const C = ['', '', 'а', 'ос', 'ия', 'ор', 'ея', 'ум', 'ан', 'ир'];

const PLANET_TYPES: PlanetType[] = ['volcanic', 'ocean', 'barren', 'ice', 'gas', 'garden', 'hive'];
const STARS: StarKind[] = ['yellow', 'red', 'blue', 'white', 'orange'];

export interface GalaxyMap {
  systems: StarSystem[];
  planets: Planet[];
  stations: Station[];
  war: { a: FactionId; b: FactionId } | null;
}

function nameOf(rng: () => number, used: Set<string>): string {
  for (let k = 0; k < 30; k++) {
    const n =
      A[Math.floor(rng() * A.length)] +
      B[Math.floor(rng() * B.length)] +
      C[Math.floor(rng() * C.length)];
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  const fallback = `Сектор-${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function mst(pts: { x: number; y: number }[]): [number, number][] {
  const n = pts.length;
  const inT = new Array<boolean>(n).fill(false);
  const dist = new Array<number>(n).fill(Infinity);
  const parent = new Array<number>(n).fill(-1);
  dist[0] = 0;
  const edges: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!inT[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u < 0) break;
    inT[u] = true;
    if (parent[u] >= 0) edges.push([parent[u], u]);
    for (let v = 0; v < n; v++) {
      if (inT[v]) continue;
      const d = dist2(pts[u]!.x, pts[u]!.y, pts[v]!.x, pts[v]!.y);
      if (d < dist[v]!) {
        dist[v] = d;
        parent[v] = u;
      }
    }
  }
  return edges;
}

export function generateMap(seed: number, settings?: GalaxySettings): GalaxyMap {
  const rng = mulberry32(seed);
  const n = systemCount(settings?.size ?? 'medium', rng());
  const reach = absoluteReach(settings?.invaders ?? 'waking');
  const pts = Array.from({ length: n }, () => {
    const a = rng() * Math.PI * 2;
    const r = 160 + Math.sqrt(rng()) * 980;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < n; i++) {
      let fx = 0;
      let fy = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = pts[i]!.x - pts[j]!.x;
        const dy = pts[i]!.y - pts[j]!.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < 240) {
          fx += (dx / d) * (240 - d);
          fy += (dy / d) * (240 - d);
        }
      }
      pts[i]!.x += fx * 0.12;
      pts[i]!.y += fy * 0.12;
    }
  }

  const edgeSet = new Set<string>();
  const degree = new Array<number>(n).fill(0);
  const addEdge = (i: number, j: number) => {
    if (i === j) return;
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    const key = `${a}-${b}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    degree[a] = (degree[a] ?? 0) + 1;
    degree[b] = (degree[b] ?? 0) + 1;
  };
  for (const [i, j] of mst(pts)) addEdge(i, j);
  for (let i = 0; i < n; i++) {
    const nearest = pts
      .map((p, j) => ({ j, d: dist2(pts[i]!.x, pts[i]!.y, p.x, p.y) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d || a.j - b.j);
    for (const cand of nearest.slice(0, 3)) {
      if ((degree[i] ?? 0) >= 3) break;
      if (cand.d > 460 * 460) break;
      if ((degree[cand.j] ?? 0) >= 4) continue;
      addEdge(i, cand.j);
    }
  }

  const links: string[][] = Array.from({ length: n }, () => []);
  const systems: StarSystem[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < n; i++) {
    const id = `s${i}`;
    systems.push({
      id,
      name: nameOf(rng, usedNames),
      x: pts[i]!.x,
      y: pts[i]!.y,
      star: STARS[Math.floor(rng() * STARS.length)]!,
      security: 0.5,
      owner: 'free',
      prevOwner: 'free',
      home: null,
      links: [],
      planetIds: [],
      stationIds: [],
      gates: [],
      warScore: 0,
      challenger: null,
      belt: rng() > 0.45 ? 1800 + rng() * 900 : null,
      hue: rng(),
    });
  }
  for (const key of edgeSet) {
    const [a, b] = key.split('-').map(Number);
    links[a]!.push(`s${b}`);
    links[b]!.push(`s${a}`);
  }
  for (let i = 0; i < n; i++) {
    systems[i]!.links = links[i]!.sort();
  }

  const homes = pickHomes(systems);
  const livingHomes = LIVING_FACTIONS.map((f, i) => ({ f, id: homes[i]! }));
  const absHome = homes[4]!;
  for (const h of livingHomes) {
    const sys = systems.find((s) => s.id === h.id)!;
    sys.home = h.f;
    sys.owner = h.f;
  }
  const abs = systems.find((s) => s.id === absHome)!;
  abs.home = 'absolute';
  abs.owner = 'absolute';
  abs.security = 0.04;
  abs.prevOwner = 'free';

  const hop = (origin: string): Map<string, number> => {
    const dist = new Map<string, number>();
    const q = [origin];
    dist.set(origin, 0);
    while (q.length) {
      const cur = q.shift()!;
      const d0 = dist.get(cur)!;
      const sys = systems.find((s) => s.id === cur)!;
      for (const nId of [...sys.links].sort()) {
        if (dist.has(nId)) continue;
        dist.set(nId, d0 + 1);
        q.push(nId);
      }
    }
    return dist;
  };
  const hopMaps = new Map<string, Map<string, number>>();
  for (const h of [...livingHomes.map((h) => h.id), absHome]) hopMaps.set(h, hop(h));

  for (const sys of systems) {
    if (sys.home === 'absolute') continue;
    let best: FactionId = 'free';
    let bestD = 99;
    let second = 99;
    for (const h of livingHomes) {
      const d = hopMaps.get(h.id)!.get(sys.id) ?? 99;
      if (d < bestD || (d === bestD && h.f < best)) {
        second = bestD;
        bestD = d;
        best = h.f;
      } else if (d < second) second = d;
    }
    const absD = hopMaps.get(absHome)!.get(sys.id) ?? 99;
    if (sys.home) {
      best = sys.home;
      bestD = 0;
    }
    if (!sys.home && (bestD >= 4 || absD <= reach)) {
      sys.owner = absD <= reach ? 'absolute' : 'free';
    } else if (!sys.home) sys.owner = best;
    sys.prevOwner = sys.owner === 'absolute' ? (best === 'free' ? 'solari' : best) : sys.owner;
    const sec = clamp(0.08, 0.95, 0.94 - bestD * 0.16);
    sys.security = sys.owner === 'free' ? sec * 0.55 : sys.owner === 'absolute' ? 0.04 : sec;
    if (second <= bestD + 1 && bestD > 0 && sys.owner !== 'free' && sys.owner !== 'absolute') {
      const rival = livingHomes.find((h) => h.f !== sys.owner && (hopMaps.get(h.id)!.get(sys.id) ?? 99) === second);
      if (rival && sys.security < 0.72) {
        sys.challenger = rival.f;
        sys.security *= 0.85;
      }
    }
  }
  for (const sys of systems) {
    if (sys.owner === 'absolute') {
      sys.security = Math.min(sys.security, 0.08);
      if (sys.home !== 'absolute') sys.challenger = sys.prevOwner === 'absolute' || sys.prevOwner === 'free' ? 'solari' : sys.prevOwner;
    }
  }

  const planets: Planet[] = [];
  const stations: Station[] = [];
  let pCount = 0;
  let sCount = 0;
  for (const sys of systems) {
    const count = sys.home ? 3 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const type: PlanetType = sys.home === 'absolute'
        ? rng() > 0.5 ? 'barren' : 'hive'
        : sys.home
          ? i === 0
            ? sys.home === 'vekt'
              ? 'hive'
              : 'garden'
            : PLANET_TYPES[Math.floor(rng() * PLANET_TYPES.length)]!
          : PLANET_TYPES[Math.floor(rng() * PLANET_TYPES.length)]!;
      const orbit = 700 + i * 620 + rng() * 180;
      const angle = rng() * Math.PI * 2;
      const planet: Planet = {
        id: `p${pCount++}`,
        systemId: sys.id,
        name: nameOf(rng, usedNames),
        type,
        orbit,
        angle,
        angVel: (0.015 + rng() * 0.03) * (rng() > 0.5 ? 1 : -1),
        radius: 120 + rng() * 90,
        x: Math.cos(angle) * orbit,
        y: Math.sin(angle) * orbit,
        spin: 0.15 + rng() * 0.4,
      };
      planets.push(planet);
      sys.planetIds.push(planet.id);
      const wantStation = i === 0 || sys.home !== null || rng() > 0.62;
      if (!wantStation) continue;
      const station: Station = {
        id: `d${sCount++}`,
        name: sys.owner === 'absolute' ? `Поглотитель «${planet.name}»` : `Док «${planet.name}»`,
        systemId: sys.id,
        planetId: planet.id,
        owner: sys.owner,
        angleOff: 0.35,
        x: Math.cos(angle + 0.35) * (orbit + 90),
        y: Math.sin(angle + 0.35) * (orbit + 90),
        market: makeMarket(rng, type, sys.owner, sys.security),
      };
      stations.push(station);
      sys.stationIds.push(station.id);
    }
    for (const to of sys.links) {
      const other = systems.find((s) => s.id === to)!;
      const ang = Math.atan2(other.y - sys.y, other.x - sys.x);
      sys.gates.push({ to, x: Math.cos(ang) * 4700, y: Math.sin(ang) * 4700 });
    }
  }

  const war = pickWar(systems);
  stampWar(systems, war);
  return { systems, planets, stations, war };
}

function stampWar(systems: StarSystem[], war: { a: FactionId; b: FactionId } | null): void {
  if (!war) return;
  for (const sys of systems) {
    if (sys.owner === war.a && sys.challenger === war.b) continue;
    if (sys.owner === war.b && sys.challenger == null) {
      const neigh = sys.links.some((id) => systems.find((s) => s.id === id)?.owner === war.a);
      if (neigh) sys.challenger = war.a;
    }
    if (sys.owner === war.a && sys.challenger == null) {
      const neigh = sys.links.some((id) => systems.find((s) => s.id === id)?.owner === war.b);
      if (neigh) sys.challenger = war.b;
    }
  }
}

function pickWar(systems: StarSystem[]): { a: FactionId; b: FactionId } | null {
  let best: { a: FactionId; b: FactionId } | null = null;
  let score = 0;
  for (let i = 0; i < LIVING_FACTIONS.length; i++) {
    for (let j = i + 1; j < LIVING_FACTIONS.length; j++) {
      const a = LIVING_FACTIONS[i]!;
      const b = LIVING_FACTIONS[j]!;
      let borders = 0;
      for (const sys of systems) {
        if (sys.owner !== a && sys.owner !== b) continue;
        const other = sys.owner === a ? b : a;
        if (sys.links.some((id) => systems.find((s) => s.id === id)?.owner === other)) borders++;
      }
      if (borders > score) {
        score = borders;
        best = { a, b };
      }
    }
  }
  return score > 0 ? best : { a: 'regnar', b: 'vekt' };
}

function pickHomes(systems: StarSystem[]): string[] {
  const scored = systems.map((s) => ({ s, r: Math.hypot(s.x, s.y) }));
  const core = [...scored].sort((a, b) => a.r - b.r);
  const chosen: StarSystem[] = [];
  const takeFar = (pool: { s: StarSystem; r: number }[]) => {
    let best = pool[0]!.s;
    let bestScore = -1;
    for (const c of pool) {
      let minD = 1e9;
      for (const h of chosen) minD = Math.min(minD, Math.hypot(c.s.x - h.x, c.s.y - h.y));
      const score = chosen.length === 0 ? 1 / (c.r + 50) : minD;
      if (score > bestScore) {
        bestScore = score;
        best = c.s;
      }
    }
    chosen.push(best);
  };
  takeFar(core.slice(0, Math.max(6, Math.floor(systems.length * 0.4))));
  takeFar(scored);
  takeFar(scored);
  takeFar(scored);
  const rim = [...scored].sort((a, b) => b.r - a.r);
  let abs = rim[0]!.s;
  let absScore = -1;
  for (const c of rim.slice(0, 8)) {
    let minD = 1e9;
    for (const h of chosen) minD = Math.min(minD, Math.hypot(c.s.x - h.x, c.s.y - h.y));
    if (minD > absScore && !chosen.includes(c.s)) {
      absScore = minD;
      abs = c.s;
    }
  }
  return [...chosen.map((s) => s.id), abs.id];
}

export function syncOrbits(world: World, dt: number): void {
  for (const p of world.planets) {
    p.angle += p.angVel * dt;
    p.x = Math.cos(p.angle) * p.orbit;
    p.y = Math.sin(p.angle) * p.orbit;
  }
  for (const st of world.stations) {
    const p = world.planets.find((pl) => pl.id === st.planetId);
    if (!p) continue;
    const ang = p.angle + st.angleOff;
    st.x = Math.cos(ang) * (p.orbit + 90);
    st.y = Math.sin(ang) * (p.orbit + 90);
  }
}
