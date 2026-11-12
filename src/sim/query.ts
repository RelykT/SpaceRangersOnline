import type { Body, Pilot, Planet, StarSystem, Station, World } from './types';

export function systemById(world: World, id: string): StarSystem | undefined {
  return world.systems.find((s) => s.id === id);
}

export function stationById(world: World, id: string): Station | undefined {
  return world.stations.find((s) => s.id === id);
}

export function planetById(world: World, id: string): Planet | undefined {
  return world.planets.find((p) => p.id === id);
}

export function pilotById(world: World, id: string): Pilot | undefined {
  return world.pilots.find((p) => p.id === id);
}

export function findBody(world: World, id: string | null): Body | undefined {
  if (!id) return undefined;
  if (id === world.player.id) return world.player;
  return world.pilots.find((p) => p.id === id && !p.destroyed);
}

export function pilotsInSystem(world: World, systemId: string): Pilot[] {
  return world.pilots.filter((p) => !p.destroyed && p.systemId === systemId && !p.jump);
}

export function isNeighbor(world: World, a: string, b: string): boolean {
  const sys = systemById(world, a);
  return !!sys && sys.links.includes(b);
}

export function findPath(world: World, fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId];
  const q: string[] = [fromId];
  const prev = new Map<string, string | null>();
  prev.set(fromId, null);
  while (q.length) {
    const cur = q.shift()!;
    const sys = systemById(world, cur);
    if (!sys) continue;
    const links = [...sys.links].sort();
    for (const n of links) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === toId) {
        const path: string[] = [n];
        let p: string | null = cur;
        while (p) {
          path.push(p);
          p = prev.get(p) ?? null;
        }
        path.reverse();
        return path;
      }
      q.push(n);
    }
  }
  return null;
}

export function stationTech(world: World, station: Station): number {
  const sys = systemById(world, station.systemId);
  if (!sys) return 1;
  let t = 1;
  if (sys.security >= 0.5) t = 2;
  if (sys.security >= 0.75) t = 3;
  if (sys.home && sys.security >= 0.62) t = Math.max(t, 4);
  if (sys.owner === 'free') t = Math.min(t, 2);
  if (sys.owner === 'omnir') t = 1;
  return t;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function livingStations(world: World): Station[] {
  return world.stations.filter((s) => s.owner !== 'omnir');
}
