import { FACTION_NAME, GOOD_IDS, HULL_BY_ID, MODULE_BY_ID, crowdRadius, slotLayout } from './content';
import { buyGoods, roughCargoValue, sellGoods, stationPrice } from './economy';
import { canFitModules, computeFit, freshShip, hpFraction, hullOf } from './fitting';
import { jumpDuration } from './motion';
import { ewarAgainst } from './combat';
import { dist, findPath, isNeighbor, pilotsInSystem, stationById, systemById } from './query';
import { economyVolatility, pirateSecurity } from './origin';
import { clamp, strHash, unit } from './rng';
import type { Body, FactionId, Pilot, Role, ShipInstance, World } from './types';

const FIRST = ['Илль', 'Сорен', 'Кайра', 'Нэв', 'Торн', 'Мира', 'Орс', 'Веда', 'Шио', 'Кельм', 'Аста', 'Руо', 'Лин', 'Эвар', 'Тара', 'Йон', 'Сива', 'Гэл', 'Нор', 'Хесса', 'Окта', 'Вей', 'Саэл', 'Кира', 'Домра', 'Тиль', 'Авен', 'Ройс', 'Эста', 'Луне'];
const LAST = ['Кросс', 'Вейн', 'Суо', 'Тарн', 'Иол', 'Орвин', 'Мирад', 'Нэлос', 'Гард', 'Ульс', 'Яров', 'Дэми', 'Харн', 'Зуно', 'Лише', 'Аови', 'Финн', 'Рок', 'Нокс', 'Сари', 'Мед', 'Вир', 'Тос', 'Эста', 'Кир', 'Лом', 'Дан', 'Кор', 'Шей', 'Варс'];

export interface SpawnOpts {
  faction: FactionId;
  role: Role;
  systemId: string;
  tier?: number;
  x?: number;
  y?: number;
  dockedAt?: string | null;
  name?: string;
  escortMissionId?: string | null;
  homeStationId?: string;
  homeSystemId?: string;
}

export function hullFor(role: Role, tier: number): string {
  if (role === 'trader') return tier >= 2 ? 'korob' : 'iskra';
  if (role === 'explorer') return 'iskra';
  if (tier >= 4 && (role === 'defender' || role === 'invader')) return 'monolit';
  if (tier >= 3) return 'oplot';
  if (tier >= 2) return 'klinok';
  return 'iskra';
}

function racialKit(faction: FactionId, ids: string[]): string[] {
  const swap: Partial<Record<FactionId, Record<string, string>>> = {
    human: { zhar: 'igla', korona: 'oskol' },
    zhargi: { luch: 'rels', zhar: 'igla', zhar2: 'rels', korona: 'igla2' },
    kvissae: { igla: 'luch', igla2: 'zhar', rels: 'korona' },
    taeyori: { igla: 'luch', igla2: 'zhar2', rels: 'zhar2', plazma: 'zhar2' },
    virex: { luch: 'metka', zhar: 'plazma' },
    omnir: { luch: 'zhar', rels: 'plazma', oskol: 'zhar' },
  };
  const map = swap[faction] ?? {};
  return ids.map((id) => map[id] ?? id);
}

export function equip(hullId: string, priority: string[]): (string | null)[] {
  const layout = slotLayout(hullOf(hullId));
  const modules: (string | null)[] = layout.map(() => null);
  for (const id of priority) {
    const def = MODULE_BY_ID[id];
    if (!def) continue;
    for (let i = 0; i < layout.length; i++) {
      if (modules[i] || layout[i] !== def.slot) continue;
      modules[i] = id;
      if (!canFitModules(hullId, modules).ok) modules[i] = null;
      else break;
    }
  }
  return modules;
}

function kit(role: Role, tier: number): string[] {
  if (role === 'trader') {
    return tier >= 2
      ? ['luch', 'veil', 'poryv', 'rig-hold', 'rig-hold', 'plate', 'zapas', 'um']
      : ['luch', 'veil', 'poryv', 'rig-hold', 'zapas', 'klin'];
  }
  if (role === 'explorer') return ['luch', 'veil', 'poryv', 'rig-tug', 'zapas'];
  if (role === 'hunter') {
    return tier >= 3
      ? ['rels', 'rels', 'igla2', 'metka', 'poryv', 'veil2', 'klin2', 'srez', 'rig-range', 'rosa']
      : ['rels', 'igla', 'metka', 'poryv', 'veil', 'klin', 'rig-range', 'zapas'];
  }
  if (role === 'pirate') {
      return tier >= 2
      ? ['igla', 'igla', 'plazma', 'klinch', 'tros', 'plate', 'klin', 'zapas']
      : ['igla', 'zhar', 'tros', 'poryv', 'klin', 'zapas', 'veil'];
  }
  if (role === 'invader') {
    return tier >= 3
      ? ['zhar2', 'igla2', 'igla2', 'plazma', 'shturm', 'tros', 'klinch', 'veil2', 'plate2', 'klin2', 'srez']
      : ['zhar', 'igla', 'tros', 'klinch', 'poryv', 'veil', 'plate', 'klin'];
  }
  return tier >= 3
    ? ['igla2', 'luch', 'zhar2', 'korona', 'veil2', 'rosa', 'poryv', 'plate2', 'klin2', 'srez', 'rig-pol']
    : ['igla', 'luch', 'veil', 'poryv', 'klin', 'zapas', 'rosa'];
}

function personality(id: string, faction: FactionId): Pilot['personality'] {
  const h = strHash(id);
  const u = (shift: number) => ((h >>> shift) & 255) / 255;
  let aggression = 0.18 + u(0) * 0.72;
  let greed = 0.18 + u(8) * 0.72;
  let caution = 0.15 + u(16) * 0.7;
  const loyalty = 0.18 + u(24) * 0.72;
  if (faction === 'zhargi') {
    aggression = Math.min(1, aggression + 0.28);
    caution = Math.max(0.05, caution - 0.14);
  } else if (faction === 'taeyori') {
    aggression = Math.max(0.04, aggression - 0.28);
    caution = Math.min(1, caution + 0.26);
  } else if (faction === 'kvissae') greed = Math.min(1, greed + 0.24);
  else if (faction === 'omnir') {
    aggression = 0.92;
    caution = 0.08;
  }
  return { aggression, greed, caution, loyalty };
}

const NAMES: Partial<Record<FactionId, [string[], string[]]>> = {
  human: [['Мира', 'Йон', 'Кайра', 'Орс', 'Лин', 'Эвар', 'Тара', 'Нор'], ['Кросс', 'Вейн', 'Яров', 'Дан', 'Кор', 'Шей']],
  zhargi: [['Грах', 'Улк', 'Баз', 'Краг', 'Торн', 'Дур'], ['Камень', 'Жар', 'Горн', 'Шлак', 'Жила']],
  kvissae: [['Сива', 'Лише', 'Аови', 'Саэл', 'Финн', 'Кира'], ['Перо', 'Ветер', 'Стая', 'Блеск', 'Клин']],
  taeyori: [['Элар', 'Сион', 'Ваэл', 'Нури', 'Орн'], ['Хор', 'Память', 'Глубь', 'Свет']],
  virex: [['Нор-4', 'Тиль', 'Векс', 'Кел', 'Авен'], ['Сборка', 'Порт', 'Кабель', 'Линза']],
};

function pilotName(id: string, faction: FactionId, role: Role): string {
  if (faction === 'omnir' || role === 'invader') {
    return `Омнир-${(strHash(id) % 89) + 10}`;
  }
  const pool = NAMES[faction] ?? [FIRST, LAST];
  const a = pool[0][strHash(id) % pool[0].length]!;
  const b = pool[1][strHash(id + ':') % pool[1].length]!;
  return role === 'pirate' ? `Ржавый ${a} ${b}` : `${a} ${b}`;
}

export function spawnPilot(world: World, opts: SpawnOpts): Pilot {
  world.nextId += 1;
  const id = `n${world.nextId.toString(36)}`;
  const tier = opts.tier ?? 1;
  let hullId = hullFor(opts.role, tier);
  if (opts.faction === 'omnir' && opts.role === 'trader') hullId = 'omnir_carrier';
  if (opts.faction === 'zhargi' && opts.role === 'defender' && tier >= 3 && strHash(id) % 2 === 0) hullId = 'zhargi_cruiser';
  const ship = freshShip(hullId, equip(hullId, racialKit(opts.faction, kit(opts.role, tier))));
  const homeSys = opts.homeSystemId ?? opts.systemId;
  const station =
    (opts.homeStationId ? stationById(world, opts.homeStationId) : undefined) ??
    world.stations.find((s) => s.systemId === opts.systemId);
  const pilot: Pilot = {
    id,
    name: opts.name ?? pilotName(id, opts.faction, opts.role),
    faction: opts.faction,
    role: opts.role,
    personality: personality(id, opts.faction),
    credits: 5000 + tier * 6500,
    tier,
    systemId: opts.systemId,
    x: opts.x ?? station?.x ?? 200,
    y: opts.y ?? station?.y ?? 0,
    vx: 0,
    vy: 0,
    nav: { mode: 'approach', x: station?.x ?? 0, y: station?.y ?? 0, range: 200, followId: null },
    jump: null,
    warp: null,
    docking: null,
    dockedAt: opts.dockedAt === undefined ? null : opts.dockedAt,
    ship,
    cargo: {},
    combatTimer: 0,
    destroyed: false,
    respawnAt: 0,
    lastHitBy: null,
    hitByPlayer: false,
    ai: {
      state: opts.dockedAt ? 'dock' : opts.role === 'invader' ? 'invade' : opts.role === 'trader' ? 'dock' : 'patrol',
      targetId: null,
      destSystemId: null,
      stationId: station?.id ?? null,
      goodId: null,
      qty: 0,
      timer: opts.dockedAt ? 2 + unit(world.seed, strHash(id), 1) * 8 : 0,
      route: [],
      routeIndex: 0,
      nextThink: 0.2 + unit(world.seed, strHash(id), 2) * 2.2,
      fleeUntil: 0,
      homeSystemId: homeSys,
      homeStationId: opts.homeStationId ?? station?.id ?? '',
      visited: [opts.systemId],
      escortMissionId: opts.escortMissionId ?? null,
      announced: false,
      grudgeId: null,
      grudgeUntil: 0,
    },
  };
  if (opts.role === 'trader') pilot.cargo[opts.faction === 'omnir' ? 'biomass' : 'al'] = 6 + (strHash(id) % 8);
  world.pilots.push(pilot);
  return pilot;
}

export function revivePilot(world: World, pilot: Pilot): void {
  const home = systemById(world, pilot.ai.homeSystemId);
  const station =
    world.stations.find((s) => s.systemId === pilot.ai.homeSystemId && s.owner === pilot.faction) ??
    world.stations.find((s) => s.owner === pilot.faction) ??
    (home ? world.stations.find((s) => s.systemId === home.id) : undefined) ??
    world.stations[0];
  if (!station) return;
  pilot.destroyed = false;
  let hullId = hullFor(pilot.role, pilot.tier);
  if (pilot.faction === 'omnir' && pilot.role === 'trader') hullId = 'omnir_carrier';
  if (pilot.ship.hullId === 'zhargi_cruiser') hullId = 'zhargi_cruiser';
  pilot.ship = freshShip(hullId, equip(hullId, racialKit(pilot.faction, kit(pilot.role, pilot.tier))));
  pilot.systemId = station.systemId;
  pilot.dockedAt = station.id;
  pilot.x = station.x;
  pilot.y = station.y;
  pilot.vx = 0;
  pilot.vy = 0;
  pilot.jump = null;
  pilot.warp = null;
  pilot.docking = null;
  pilot.cargo = {};
  pilot.combatTimer = 0;
  pilot.hitByPlayer = false;
  pilot.lastHitBy = null;
  pilot.credits = Math.max(800, Math.floor(pilot.credits * 0.65));
  pilot.ai.targetId = null;
  pilot.ai.state = 'dock';
  pilot.ai.timer = 8;
  pilot.ai.route = [];
  pilot.ai.routeIndex = 0;
  pilot.ai.destSystemId = null;
  pilot.ai.goodId = null;
  pilot.ai.announced = false;
  pilot.ai.stationId = station.id;
}

export function populate(world: World): void {
  const systems = [...world.systems].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  systems.forEach((sys, index) => {
    const station = world.stations.find((s) => s.systemId === sys.id);
    if (sys.owner === 'omnir') {
      const n = sys.home ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        spawnPilot(world, {
          faction: 'omnir',
          role: 'invader',
          systemId: sys.id,
          tier: sys.home ? 3 : 2,
          x: Math.cos(ang) * 900,
          y: Math.sin(ang) * 900,
          homeSystemId: sys.id,
          homeStationId: station?.id,
        });
      }
      return;
    }
    const faction = sys.owner === 'free' || sys.owner === 'pirate' ? 'kvissae' : sys.owner;
    if (station && sys.security >= 0.42 && (sys.home || unit(world.seed, index, 11) < 0.72)) {
      spawnPilot(world, {
        faction: station.owner === 'free' ? faction : station.owner,
        role: 'trader',
        systemId: sys.id,
        tier: sys.security > 0.7 ? 2 : 1,
        dockedAt: station.id,
        homeStationId: station.id,
        homeSystemId: sys.id,
      });
    }
    if (sys.security >= 0.55 || sys.home) {
      const ang = unit(world.seed, index, 12) * Math.PI * 2;
      spawnPilot(world, {
        faction,
        role: 'defender',
        systemId: sys.id,
        tier: sys.home && sys.security > 0.7 ? 3 : sys.security > 0.6 ? 2 : 1,
        x: Math.cos(ang) * 1100,
        y: Math.sin(ang) * 1100,
        homeSystemId: sys.id,
        homeStationId: station?.id,
      });
    }
    if (sys.security < pirateSecurity(world.settings?.difficulty)) {
      spawnPilot(world, {
        faction: 'pirate',
        role: 'pirate',
        systemId: sys.id,
        tier: (sys.security < 0.16 && unit(world.seed, index, 13) < 0.55 ? 2 : 1) + (world.settings?.difficulty === 'harsh' ? 1 : 0),
        x: 1600,
        y: -400 - index * 3,
        homeSystemId: sys.id,
      });
    }
    if (sys.security > 0.38 && sys.security < 0.72 && unit(world.seed, index, 14) < 0.34) {
      spawnPilot(world, {
        faction,
        role: 'hunter',
        systemId: sys.id,
        tier: 2,
        x: -1400,
        y: 300,
        homeSystemId: sys.id,
        homeStationId: station?.id,
      });
    }
  });
  const homes = systems.filter((s) => s.home && s.home !== 'omnir');
  for (let i = 0; i < 4; i++) {
    const sys = homes[i % Math.max(1, homes.length)] ?? systems[0];
    if (!sys) break;
    const station = world.stations.find((s) => s.systemId === sys.id);
    spawnPilot(world, {
      faction: sys.owner === 'free' ? 'taeyori' : sys.owner,
      role: 'explorer',
      systemId: sys.id,
      tier: 1,
      dockedAt: station?.id ?? null,
      homeSystemId: sys.id,
      homeStationId: station?.id,
    });
  }
}

export function reinforce(world: World): void {
  let spawned = 0;
  const living = () => world.pilots.filter((p) => !p.destroyed).length;
  const systems = [...world.systems].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const sys of systems) {
    if (spawned >= 3 || living() >= 68) break;
    const here = world.pilots.filter((p) => !p.destroyed && p.systemId === sys.id);
    const station = world.stations.find((s) => s.systemId === sys.id);
    if (sys.owner === 'omnir') {
      if (here.filter((p) => p.role === 'invader').length < 2 && unit(world.seed, world.tick, strHash(sys.id)) < 0.7) {
        spawnPilot(world, {
          faction: 'omnir',
          role: 'invader',
          systemId: sys.id,
          tier: 2,
          x: 600,
          y: -200,
          homeSystemId: sys.id,
          homeStationId: station?.id,
        });
        spawned += 1;
      }
      continue;
    }
    const faction = sys.owner === 'free' || sys.owner === 'pirate' ? 'kvissae' : sys.owner;
    if ((sys.security > 0.58 || sys.home) && !here.some((p) => p.role === 'defender' && p.faction === faction)) {
      spawnPilot(world, {
        faction,
        role: 'defender',
        systemId: sys.id,
        tier: 2,
        x: 800,
        y: 200,
        homeSystemId: sys.id,
        homeStationId: station?.id,
      });
      spawned += 1;
    } else if (sys.security < 0.24 && !here.some((p) => p.role === 'pirate') && unit(world.seed, world.tick, strHash(sys.id), 4) < 0.55) {
      spawnPilot(world, {
        faction: 'pirate',
        role: 'pirate',
        systemId: sys.id,
        tier: 1,
        x: 1500,
        y: 200,
        homeSystemId: sys.id,
      });
      spawned += 1;
    }
  }
}

function warBetween(world: World, a: FactionId, b: FactionId): boolean {
  if (!world.war) return false;
  return (world.war.a === a && world.war.b === b) || (world.war.a === b && world.war.b === a);
}

function threats(world: World, pilot: Pilot): Body[] {
  const out: Body[] = [];
  for (const o of pilotsInSystem(world, pilot.systemId)) {
    if (o.id === pilot.id || o.dockedAt) continue;
    if (o.ai.targetId === pilot.id) out.push(o);
    else if (o.faction === 'omnir' && pilot.faction !== 'omnir') out.push(o);
    else if (o.role === 'pirate' && pilot.role !== 'pirate') out.push(o);
    else if (warBetween(world, o.faction, pilot.faction) && (o.role === 'defender' || o.role === 'hunter' || o.role === 'invader')) out.push(o);
  }
  const player = world.player;
  if (!player.dockedAt && !player.jump && player.systemId === pilot.systemId && player.locked.includes(pilot.id) && player.combatTimer > 0) {
    out.push(player);
  }
  return out.sort((a, b) => dist(pilot.x, pilot.y, a.x, a.y) - dist(pilot.x, pilot.y, b.x, b.y));
}

function pathRisk(world: World, path: string[], caution: number): number {
  let risk = 1;
  for (const id of path) {
    const sys = systemById(world, id);
    if (!sys) return 0;
    if (sys.owner === 'omnir') return caution > 0.28 ? 0 : 0.25;
    if (sys.security < 0.22) risk *= caution > 0.5 ? 0 : 0.4;
    else if (sys.security < 0.4) risk *= caution > 0.78 ? 0.35 : 0.8;
  }
  return risk;
}

function undock(world: World, pilot: Pilot): void {
  const st = pilot.dockedAt ? stationById(world, pilot.dockedAt) : undefined;
  pilot.dockedAt = null;
  if (st) {
    pilot.systemId = st.systemId;
    pilot.x = st.x + 150;
    pilot.y = st.y + 30;
  }
}

function npcJump(world: World, pilot: Pilot, to: string): void {
  if (pilot.jump || pilot.combatTimer > 0) return;
  if (!isNeighbor(world, pilot.systemId, to)) return;
  if (!pilot.dockedAt && ewarAgainst(world, pilot.id).scram) return;
  if (pilot.dockedAt) undock(world, pilot);
  pilot.jump = { to, from: pilot.systemId, progress: 0, duration: jumpDuration(world, pilot.systemId, to) };
  pilot.nav.mode = 'stop';
  pilot.warp = null;
}

function setTarget(pilot: Pilot, id: string | null): void {
  if (pilot.ai.targetId === id) return;
  pilot.ai.targetId = id;
  if (!id) return;
  for (let i = 0; i < pilot.ship.cycles.length; i++) {
    if (pilot.ship.modules[i]) pilot.ship.cycles[i] = Math.max(pilot.ship.cycles[i] ?? 0, 0.65);
  }
}

export function callForHelp(world: World, victim: Pilot, aggressorId: string): void {
  const sys = systemById(world, victim.systemId);
  for (const ally of pilotsInSystem(world, victim.systemId)) {
    if (ally.id === victim.id || ally.destroyed || ally.dockedAt) continue;
    const same = ally.faction === victim.faction;
    const police = (sys?.security ?? 0) > 0.62 && victim.faction !== 'pirate' && victim.faction !== 'omnir' && (ally.role === 'defender' || ally.role === 'hunter');
    if (!same && !police) continue;
    if (ally.role === 'trader' || ally.role === 'explorer') {
      startFlee(world, ally);
      continue;
    }
    if (ally.personality.loyalty < 0.42 && ally.role !== 'defender' && !police) continue;
    setTarget(ally, aggressorId);
    ally.ai.state = ally.role === 'invader' ? 'invade' : 'hunt';
  }
}

function startFlee(world: World, pilot: Pilot): void {
  pilot.ai.state = 'flee';
  pilot.ai.fleeUntil = world.time + 16 + pilot.personality.caution * 14;
  setTarget(pilot, null);
  const sys = systemById(world, pilot.systemId);
  let best = pilot.ai.homeSystemId;
  let bestSec = -1;
  for (const id of sys?.links ?? []) {
    const n = systemById(world, id);
    if (!n || n.owner === 'omnir') continue;
    if (n.security > bestSec) {
      bestSec = n.security;
      best = n.id;
    }
  }
  const path = findPath(world, pilot.systemId, best) ?? [];
  pilot.ai.destSystemId = best;
  pilot.ai.route = path;
  pilot.ai.routeIndex = Math.max(0, path.indexOf(pilot.systemId));
  const threat = threats(world, pilot)[0];
  if (threat) {
    const dx = pilot.x - threat.x;
    const dy = pilot.y - threat.y;
    const d = Math.hypot(dx, dy) || 1;
    pilot.nav = { mode: 'approach', x: pilot.x + (dx / d) * 2800, y: pilot.y + (dy / d) * 2800, range: 0, followId: null };
  }
}

function risky(pilot: Pilot, prey: Body): boolean {
  const my = computeFit(pilot.ship);
  const their = computeFit(prey.ship);
  const myHp = hpFraction(pilot.ship);
  const theirHp = hpFraction(prey.ship);
  if (myHp < 0.35 && theirHp > myHp) return true;
  const limit = my.dps * (1.05 + pilot.personality.caution * 0.9);
  if (their.dps > limit && theirHp > 0.4 && pilot.personality.aggression < 0.78) return true;
  return false;
}

function choosePrey(world: World, pilot: Pilot): Body | null {
  if (pilot.faction === 'zhargi' && pilot.ai.grudgeUntil > world.time && pilot.ai.grudgeId) {
    const held = findBodySafe(world, pilot.ai.grudgeId);
    if (held && held.systemId === pilot.systemId) return held;
  }
  const local = pilotsInSystem(world, pilot.systemId).filter((p) => p.id !== pilot.id && !p.dockedAt);
  if (pilot.role === 'invader') {
    const list = local.filter((p) => p.faction !== 'omnir');
    const player = world.player;
    const bodies: Body[] = [...list];
    if (!player.dockedAt && !player.jump && player.systemId === pilot.systemId) bodies.push(player);
    bodies.sort((a, b) => dist(pilot.x, pilot.y, a.x, a.y) - dist(pilot.x, pilot.y, b.x, b.y));
    return bodies[0] ?? null;
  }
  if (pilot.role === 'defender' || pilot.role === 'hunter') {
    const player = world.player;
    const bodies: Body[] = local.filter((p) => p.role === 'pirate' || p.faction === 'omnir' || (warBetween(world, pilot.faction, p.faction) && (p.role === 'defender' || p.role === 'hunter' || p.role === 'invader')));
    if (!player.dockedAt && !player.jump && player.systemId === pilot.systemId) {
      const hostileRep = (player.reputation[pilot.faction] ?? 0) < -20;
      const shootingUs = player.locked.includes(pilot.id) && player.combatTimer > 0;
      if ((hostileRep || shootingUs) && !risky(pilot, player)) bodies.push(player);
    }
    if (pilot.personality.loyalty > 0.55) {
      const mate = local.find((p) => p.faction === pilot.faction && p.ai.targetId && (p.role === 'defender' || p.role === 'hunter'));
      if (mate?.ai.targetId) {
        const shared = findBodySafe(world, mate.ai.targetId);
        if (shared && shared.systemId === pilot.systemId) bodies.unshift(shared);
      }
    }
    bodies.sort((a, b) => dist(pilot.x, pilot.y, a.x, a.y) - dist(pilot.x, pilot.y, b.x, b.y));
    return bodies.find((b) => !risky(pilot, b)) ?? null;
  }
  if (pilot.role === 'pirate') {
    if (pilot.personality.loyalty > 0.58) {
      const mate = local.find((p) => p.role === 'pirate' && p.ai.targetId);
      const shared = mate?.ai.targetId ? findBodySafe(world, mate.ai.targetId) : undefined;
      if (shared && shared.systemId === pilot.systemId && dist(pilot.x, pilot.y, shared.x, shared.y) < 2800 && !risky(pilot, shared)) return shared;
    }
    let best: Body | null = null;
    let bestScore = 0;
    const consider = (prey: Body, cargoValue: number, hullPrice: number) => {
      if (prey.dockedAt || prey.jump) return;
      if (risky(pilot, prey)) return;
      const dps = computeFit(prey.ship).dps;
      const score = ((cargoValue + hullPrice * 0.04 + 900) / (dps + 14)) * (0.55 + pilot.personality.greed);
      const gate = 70 * (0.45 + pilot.personality.caution);
      if (score > gate && score > bestScore) {
        bestScore = score;
        best = prey;
      }
    };
    for (const p of local) {
      if (p.role === 'pirate' || p.faction === 'omnir') continue;
      if (p.role !== 'trader' && p.role !== 'explorer' && p.ship.hullId !== 'korob' && pilot.personality.aggression < 0.62) continue;
      consider(p, roughCargoValue(p.cargo), HULL_BY_ID[p.ship.hullId]?.price ?? 8000);
    }
    const player = world.player;
    if (!player.dockedAt && !player.jump && player.systemId === pilot.systemId) {
      const heat = (player.reputation.pirate ?? 0) < -15 ? 1.35 : 1;
      consider(player, roughCargoValue(player.cargo) * heat, HULL_BY_ID[player.ship.hullId]?.price ?? 8000);
    }
    return best;
  }
  return null;
}

function findBodySafe(world: World, id: string): Body | undefined {
  if (id === world.player.id) return world.player.dockedAt || world.player.jump ? undefined : world.player;
  return world.pilots.find((p) => p.id === id && !p.destroyed && !p.dockedAt && !p.jump);
}

function thinkTrader(world: World, pilot: Pilot): void {
  const swing = economyVolatility(world.settings?.economy);
  const danger = threats(world, pilot)[0];
  if (danger && dist(pilot.x, pilot.y, danger.x, danger.y) < 1400 + pilot.personality.caution * 900) {
    startFlee(world, pilot);
    return;
  }
  if (!pilot.dockedAt || !pilot.ai.stationId && !pilot.dockedAt) {
    pilot.ai.state = 'travel';
    return;
  }
  const here = stationById(world, pilot.dockedAt);
  if (!here) return;
  if (pilot.ai.goodId && (pilot.cargo[pilot.ai.goodId] ?? 0) > 0 && pilot.dockedAt === pilot.ai.stationId) {
    const sys = systemById(world, here.systemId);
    const sold = sellGoods(here, pilot.ai.goodId, pilot.cargo[pilot.ai.goodId] ?? 0, world.events, !!sys?.challenger, swing);
    pilot.credits += sold.credits;
    delete pilot.cargo[pilot.ai.goodId];
    pilot.ai.goodId = null;
    pilot.ai.timer = 6;
    return;
  }
  if (pilot.ai.timer > 0) return;
  let best: { score: number; qty: number; good: string; destId: string; destSys: string; path: string[] } | null = null;
  for (const dest of world.stations) {
    if (dest.id === here.id || dest.owner === 'omnir') continue;
    const path = findPath(world, here.systemId, dest.systemId);
    if (!path || path.length > 5) continue;
    const risk = pathRisk(world, path, pilot.personality.caution);
    if (risk <= 0) continue;
    const destSys = systemById(world, dest.systemId);
    const hereSys = systemById(world, here.systemId);
    for (const good of GOOD_IDS) {
      const buy = stationPrice(here, good, world.events, !!hereSys?.challenger, swing);
      const sell = stationPrice(dest, good, world.events, !!destSys?.challenger, swing);
      const profit = sell - buy;
      if (profit < 6) continue;
      const stock = here.market[good]?.stock ?? 0;
      const qty = Math.min(32, Math.floor(stock * 0.28), Math.floor(pilot.credits / Math.max(1, buy)));
      if (qty < 4) continue;
      const score = profit * qty * risk / path.length;
      if (!best || score > best.score) best = { score, qty, good, destId: dest.id, destSys: dest.systemId, path };
    }
  }
  if (!best || best.score < 140) {
    pilot.ai.timer = 10;
    return;
  }
  const bought = buyGoods(here, best.good, best.qty, world.events, !!systemById(world, here.systemId)?.challenger, pilot.credits, swing);
  if (bought.qty <= 0) {
    pilot.ai.timer = 8;
    return;
  }
  pilot.credits -= bought.credits;
  pilot.cargo[best.good] = (pilot.cargo[best.good] ?? 0) + bought.qty;
  pilot.ai.goodId = best.good;
  pilot.ai.qty = bought.qty;
  pilot.ai.stationId = best.destId;
  pilot.ai.destSystemId = best.destSys;
  pilot.ai.route = best.path;
  pilot.ai.routeIndex = Math.max(0, best.path.indexOf(pilot.systemId));
  pilot.ai.state = 'travel';
  undock(world, pilot);
}

function thinkExplorer(world: World, pilot: Pilot): void {
  const danger = threats(world, pilot)[0];
  if (danger) {
    startFlee(world, pilot);
    return;
  }
  if (pilot.dockedAt && pilot.ai.timer > 0) return;
  let dest = pilot.ai.homeSystemId;
  let best = -1;
  for (const sys of world.systems) {
    if (sys.owner === 'omnir') continue;
    const seen = pilot.ai.visited.filter((id) => id === sys.id).length;
    const score = (pilot.ai.visited.includes(sys.id) ? 0 : 3) - seen + sys.security;
    if (score > best) {
      best = score;
      dest = sys.id;
    }
  }
  const path = findPath(world, pilot.systemId, dest) ?? [];
  pilot.ai.destSystemId = dest;
  pilot.ai.route = path;
  pilot.ai.routeIndex = Math.max(0, path.indexOf(pilot.systemId));
  const st = world.stations.find((s) => s.systemId === dest && s.owner !== 'omnir');
  pilot.ai.stationId = st?.id ?? null;
  pilot.ai.state = 'explore';
  if (pilot.dockedAt) undock(world, pilot);
}

function thinkFighter(world: World, pilot: Pilot): void {
  const hp = hpFraction(pilot.ship);
  const fleeAt = pilot.role === 'invader' ? 0.1 : 0.2 + pilot.personality.caution * 0.28 - pilot.personality.loyalty * 0.08;
  if (hp < fleeAt) {
    const threat = threats(world, pilot)[0];
    if (threat) {
      startFlee(world, pilot);
      return;
    }
  }
  let prey = choosePrey(world, pilot);
  if (!prey && pilot.ai.targetId) {
    const existing = findBodySafe(world, pilot.ai.targetId);
    if (existing && !risky(pilot, existing)) prey = existing;
  }
  if (prey) {
    setTarget(pilot, prey.id);
    pilot.ai.state = pilot.role === 'invader' ? 'invade' : 'hunt';
    if (prey.systemId !== pilot.systemId) {
      const path = findPath(world, pilot.systemId, prey.systemId) ?? [];
      pilot.ai.route = path;
      pilot.ai.routeIndex = Math.max(0, path.indexOf(pilot.systemId));
      pilot.ai.destSystemId = prey.systemId;
    }
    if (!pilot.ai.announced && prey.id === world.player.id) {
      pilot.ai.announced = true;
      world.logs.push({ time: world.time, text: `«${pilot.name}» берёт вас на прицел.` });
    }
    return;
  }
  setTarget(pilot, null);
  if (pilot.role === 'pirate') {
    const sys = systemById(world, pilot.systemId);
    const neigh = [...(sys?.links ?? [])].sort();
    const low = neigh
      .map((id) => systemById(world, id))
      .filter((s): s is NonNullable<typeof s> => !!s && s.owner !== 'omnir')
      .sort((a, b) => a.security - b.security || (a.id < b.id ? -1 : 1))[0];
    if (low && (sys?.security ?? 1) > 0.35) {
      pilot.ai.destSystemId = low.id;
      pilot.ai.route = findPath(world, pilot.systemId, low.id) ?? [];
      pilot.ai.routeIndex = 0;
      pilot.ai.stationId = null;
      pilot.ai.state = 'travel';
      return;
    }
  }
  if (pilot.role === 'invader') {
    const sys = systemById(world, pilot.systemId);
    if (sys?.owner !== 'omnir') {
      pilot.ai.state = 'invade';
      return;
    }
    const neigh = [...(sys?.links ?? [])]
      .map((id) => systemById(world, id))
      .filter((s): s is NonNullable<typeof s> => !!s && s.owner !== 'omnir')
      .sort((a, b) => a.security - b.security || (a.id < b.id ? -1 : 1))[0];
    if (neigh) {
      pilot.ai.destSystemId = neigh.id;
      pilot.ai.route = findPath(world, pilot.systemId, neigh.id) ?? [];
      pilot.ai.routeIndex = 0;
      pilot.ai.state = 'invade';
      return;
    }
  }
  pilot.ai.state = 'patrol';
  const st = world.stations.find((s) => s.systemId === pilot.systemId);
  const ang = unit(world.seed, strHash(pilot.id), Math.floor(world.time / 14)) * Math.PI * 2;
  const rad = 700 + (strHash(pilot.id) % 400);
  pilot.nav = {
    mode: 'approach',
    x: (st?.x ?? 0) + Math.cos(ang) * rad,
    y: (st?.y ?? 0) + Math.sin(ang) * rad,
    range: 90,
    followId: null,
  };
}

function think(world: World, pilot: Pilot): void {
  if (pilot.ai.escortMissionId) {
    if (pilot.dockedAt && pilot.ai.timer > 0) return;
    pilot.ai.state = 'escort';
    return;
  }
  if (pilot.ai.state === 'flee') {
    if (world.time < pilot.ai.fleeUntil && threats(world, pilot).length > 0) return;
    pilot.ai.state = pilot.role === 'trader' ? 'travel' : 'patrol';
  }
  if (pilot.role === 'trader') thinkTrader(world, pilot);
  else if (pilot.role === 'explorer') thinkExplorer(world, pilot);
  else thinkFighter(world, pilot);
}

function travelToward(world: World, pilot: Pilot): void {
  if (pilot.jump) return;
  const destSys = pilot.ai.destSystemId;
  if (!destSys) {
    pilot.ai.state = pilot.role === 'trader' ? 'dock' : 'patrol';
    return;
  }
  if (pilot.ai.route[pilot.ai.routeIndex] !== pilot.systemId) {
    const idx = pilot.ai.route.indexOf(pilot.systemId);
    if (idx >= 0) pilot.ai.routeIndex = idx;
    else {
      const path = findPath(world, pilot.systemId, destSys) ?? [];
      pilot.ai.route = path;
      pilot.ai.routeIndex = 0;
    }
  }
  if (pilot.systemId !== destSys) {
    const next = pilot.ai.route[pilot.ai.routeIndex + 1];
    if (next) npcJump(world, pilot, next);
    return;
  }
  const station = (pilot.ai.stationId ? stationById(world, pilot.ai.stationId) : undefined) ?? world.stations.find((s) => s.systemId === destSys);
  if (!station || pilot.role === 'pirate' || pilot.role === 'invader') {
    pilot.ai.state = pilot.role === 'invader' ? 'invade' : pilot.role === 'explorer' ? 'explore' : 'patrol';
    if (pilot.role === 'explorer' && station) {
      pilot.dockedAt = station.id;
      pilot.x = station.x;
      pilot.y = station.y;
      pilot.ai.timer = 8;
      if (!pilot.ai.visited.includes(destSys)) pilot.ai.visited.push(destSys);
      const ev = world.events.find((e) => e.systemId === destSys);
      if (ev) {
        world.rumors.push({ id: `r${world.tick}-${pilot.id}`, text: `Разведчик из ${FACTION_NAME[pilot.faction]}: ${ev.text}`, systemId: destSys, time: world.time });
      }
    }
    return;
  }
  if (pilot.dockedAt === station.id) {
    pilot.ai.state = 'dock';
    pilot.ai.timer = 4;
    return;
  }
  pilot.nav = { mode: 'approach', x: station.x, y: station.y, range: 80, followId: null };
  if (dist(pilot.x, pilot.y, station.x, station.y) < 140 && Math.hypot(pilot.vx, pilot.vy) < 90) {
    pilot.dockedAt = station.id;
    pilot.x = station.x;
    pilot.y = station.y;
    pilot.vx = 0;
    pilot.vy = 0;
    pilot.ai.state = 'dock';
    pilot.ai.timer = 5;
    pilot.ai.stationId = station.id;
  }
}

function execute(world: World, pilot: Pilot): void {
  if (pilot.ai.state === 'dock' && pilot.dockedAt) return;
  if (pilot.ai.state === 'travel' || pilot.ai.state === 'explore' || pilot.ai.state === 'escort' || pilot.ai.state === 'flee') {
    travelToward(world, pilot);
    return;
  }
  if (pilot.ai.state === 'hunt' || pilot.ai.state === 'invade') {
    const tgt = pilot.ai.targetId ? findBodySafe(world, pilot.ai.targetId) : undefined;
    if (!tgt) {
      pilot.ai.targetId = null;
      return;
    }
    if (tgt.systemId !== pilot.systemId) {
      pilot.ai.destSystemId = tgt.systemId;
      travelToward(world, pilot);
      return;
    }
    const fit = computeFit(pilot.ship);
    const opt = fit.weapons.find((w) => w.online)?.optimal ?? 480;
    const gap = crowdRadius(pilot.ship.hullId) + crowdRadius(tgt.ship.hullId);
    const stagger = (strHash(pilot.id) % 5) * 48;
    pilot.nav = {
      mode: 'orbit',
      x: tgt.x,
      y: tgt.y,
      range: clamp(Math.max(opt * 0.85, gap + stagger), 240, 1700),
      followId: tgt.id,
    };
  }
}

export function updateAI(world: World, dt: number): void {
  const pilots = [...world.pilots].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const pilot of pilots) {
    if (pilot.destroyed) continue;
    if ((pilot.ai.state === 'dock' || pilot.ai.escortMissionId) && pilot.dockedAt) pilot.ai.timer -= dt;
    if (world.time >= pilot.ai.nextThink) {
      pilot.ai.nextThink = world.time + 1.3 + unit(world.seed, strHash(pilot.id), world.tick) * 0.9;
      think(world, pilot);
    }
    execute(world, pilot);
  }
}

export function refitShip(role: Role, tier: number): ShipInstance {
  const hullId = hullFor(role, tier);
  return freshShip(hullId, equip(hullId, kit(role, tier)));
}
