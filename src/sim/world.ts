import { callForHelp, populate, revivePilot, spawnPilot, updateAI, reinforce } from './ai';
import { applyDamage, application, ewarAgainst, lockSeconds, transversal } from './combat';
import {
  DTYPE_COLOR,
  FACTION_NAME,
  FACTION_SHOT,
  dockGreeting,
  GOOD_BY_ID,
  HULL_BY_ID,
  MODULE_BY_ID,
  STARTER_FIT,
  emptyRep,
  slotLayout,
} from './content';
import { buyGoods, sellGoods, tickMarket } from './economy';
import { cargoFree, cargoUsed, computeFit, freshShip, hullOf, transferFit } from './fitting';
import {
  CAREER_BY_ID,
  DEFAULT_SETTINGS,
  creditMultiplier,
  economyVolatility,
  introText,
  makeOrigin,
  skillBonus,
  startingReputation,
} from './origin';
import { HULL_GATES, HULL_RANK, HULL_TRACK, RANKS, TRACK_BY_ID, WEAPON_GROUP, careerProficiency, gateText, pointsEarned, profLevel, rankOf, weaponGate } from './progress';
import { generateMap, syncOrbits } from './galaxy';
import { jumpDuration, separateBodies, updateMotion } from './motion';
import { dist, findBody, findPath, isNeighbor, planetById, pilotsInSystem, stationById, stationTech, systemById } from './query';
import { clamp, strHash, unit } from './rng';
import type { Body, CaptainOrigin, Command, FactionId, GalaxySettings, GameEvent, Mission, Pilot, Player, PlayableRace, SkillId, StarSystem, World } from './types';
import { LIVING_FACTIONS, SIM_DT } from './types';

function pushLog(world: World, text: string): void {
  world.logs.push({ time: world.time, text });
  if (world.logs.length > 60) world.logs.splice(0, world.logs.length - 60);
}

function bumpRep(world: World, faction: FactionId, delta: number): void {
  if (faction === 'free') return;
  const charm = world.player.skills?.charm ?? 0;
  const scaled = delta > 0 ? delta * (1 + 0.15 * charm) : delta;
  const cur = world.player.reputation[faction] ?? 0;
  world.player.reputation[faction] = clamp(cur + scaled, -100, 100);
}

function grantXp(world: World, amount: number): void {
  if (amount <= 0) return;
  const before = pointsEarned(world.player.xp);
  world.player.xp += amount;
  const after = pointsEarned(world.player.xp);
  if (after > before) pushLog(world, `Опыт сложился в очко навыка. Свободно: ${after - world.player.spent}.`);
}

function grantProf(world: World, track: string, amount: number): void {
  if (!track || amount <= 0) return;
  const cur = world.player.proficiency[track] ?? 0;
  const next = cur + amount;
  world.player.proficiency[track] = next;
  if (profLevel(next) > profLevel(cur)) {
    pushLog(world, `Освоение «${TRACK_BY_ID[track]?.name ?? track}»: уровень ${profLevel(next)}.`);
  }
}

function livingRep(world: World, delta: number, except?: FactionId): void {
  for (const f of LIVING_FACTIONS) if (f !== except) bumpRep(world, f, delta);
}

export interface NewGameOptions {
  race?: PlayableRace;
  career?: CaptainOrigin['career'];
  portrait?: number;
  settings?: Partial<GalaxySettings>;
}

export function createWorld(seed: number, playerName: string, options: NewGameOptions = {}): World {
  const safe = seed >>> 0 || 1;
  const settings: GalaxySettings = { ...DEFAULT_SETTINGS, ...options.settings };
  const map = generateMap(safe, settings);
  const world = {
    seed: safe,
    settings,
    time: 0,
    tick: 0,
    nextId: 1,
    lastEventWindow: -1,
    lastReinforceWindow: -1,
    systems: map.systems,
    planets: map.planets,
    stations: map.stations,
    pilots: [],
    wrecks: [],
    events: [],
    missions: [],
    rumors: [],
    logs: [],
    pings: [],
    war: map.war,
    player: undefined as unknown as Player,
  } as World;
  populate(world);
  const origin = makeOrigin(options.race ?? 'kvissae', options.career ?? 'explorer', options.portrait ?? 1);
  world.player = makePlayer(world, playerName.trim().slice(0, 24) || 'Илль Сед', origin);
  addIntro(world);
  const home = stationById(world, world.player.dockedAt ?? '');
  const sys = home ? systemById(world, home.systemId) : undefined;
  pushLog(world, introText(origin, home?.name ?? 'док', sys?.name ?? 'край'));
  pushLog(world, `Зерно ${world.seed}. Пауза только в меню.`);
  return world;
}

function fitOf(body: Body, scrammed = false) {
  if (body.id !== 'player') return computeFit(body.ship, { scrammed });
  const player = body as Player;
  const race = player.origin?.race ?? 'kvissae';
  const skills = player.skills ?? player.origin?.skills;
  return computeFit(body.ship, { scrammed, bonus: skills ? skillBonus(skills, race) : undefined });
}

function makePlayer(world: World, name: string, origin: CaptainOrigin): Player {
  const homes = world.stations
    .filter((st) => systemById(world, st.systemId)?.home === origin.race)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const same = world.stations.filter((st) => st.owner === origin.race).sort((a, b) => (a.id < b.id ? -1 : 1));
  const station = homes[0] ?? same[0] ?? world.stations.find((st) => st.owner !== 'omnir') ?? world.stations[0]!;
  const career = CAREER_BY_ID[origin.career];
  const ship = freshShip(career.hullId, career.modules);
  const skills = { ...origin.skills };
  const fitted = computeFit(ship, { bonus: skillBonus(skills, origin.race) });
  ship.shield = fitted.maxShield;
  ship.armor = fitted.maxArmor;
  ship.hull = fitted.maxHull;
  ship.cap = fitted.maxCap;
  return {
    id: 'player',
    name,
    faction: origin.race,
    systemId: station.systemId,
    x: station.x,
    y: station.y,
    vx: 0,
    vy: 0,
    nav: { mode: 'stop', x: station.x, y: station.y, range: 0, followId: null },
    jump: null,
    warp: null,
    docking: null,
    dockedAt: station.id,
    ship,
    cargo: { ...career.cargo },
    combatTimer: 0,
    credits: Math.round(career.credits * creditMultiplier(world.settings?.difficulty ?? 'captain')),
    locker: {},
    reputation: startingReputation(origin),
    route: null,
    routeIndex: 0,
    autoJumpAt: 0,
    lastStationId: station.id,
    selectedId: null,
    lock: null,
    locked: [],
    kills: 0,
    tradeScore: {},
    insuranceHull: career.hullId,
    pendingDock: null,
    pendingJump: null,
    origin,
    skills,
    xp: 0,
    spent: 0,
    proficiency: careerProficiency(origin.career),
    visited: [station.systemId],
  };
}

function addIntro(world: World): void {
  const home = stationById(world, world.player.dockedAt ?? '');
  if (!home) return;
  const dest = world.stations
    .filter((s) => s.id !== home.id && s.owner !== 'omnir')
    .map((s) => ({ s, path: findPath(world, home.systemId, s.systemId) }))
    .filter((x) => x.path && x.path.length >= 2 && x.path.length <= 3)
    .sort((a, b) => a.s.id.localeCompare(b.s.id))[0]?.s ?? world.stations.find((s) => s.id !== home.id);
  if (!dest) return;
  world.missions.push({
    id: 'intro-deliver',
    type: 'deliver',
    status: 'offer',
    stationId: home.id,
    title: 'Первый контракт: зеркальный сплав',
    desc: `Док выдаёт 12 ед. зеркального сплава. Довезите их на ${dest.name}, не продав по пути. Награда ждёт на месте.`,
    reward: 4600,
    repFaction: home.owner === 'free' ? 'kvissae' : home.owner,
    repAmount: 5,
    expires: 900,
    goodId: 'alloy',
    qty: 12,
    destStationId: dest.id,
    destSystemId: dest.systemId,
    targetPilotId: null,
    escortPilotId: null,
    witnessed: false,
    minRank: 0,
  });
}

const LEGACY_FACTION: Record<string, FactionId> = {
  eira: 'human',
  solari: 'kvissae',
  regnar: 'zhargi',
  nimva: 'taeyori',
  vekt: 'virex',
  absolute: 'omnir',
};

function migrateFaction(id: string): FactionId {
  return LEGACY_FACTION[id] ?? (id as FactionId);
}

export function rehydrate(world: World): World {
  world.settings ??= { ...DEFAULT_SETTINGS };
  world.player.faction = migrateFaction(String(world.player.faction));
  for (const sys of world.systems ?? []) {
    sys.owner = migrateFaction(String(sys.owner));
    if (sys.home) sys.home = migrateFaction(String(sys.home));
    if (sys.challenger) sys.challenger = migrateFaction(String(sys.challenger));
    if (sys.prevOwner) sys.prevOwner = migrateFaction(String(sys.prevOwner));
  }
  for (const st of world.stations ?? []) st.owner = migrateFaction(String(st.owner));
  for (const pilot of world.pilots ?? []) {
    pilot.faction = migrateFaction(String(pilot.faction));
    pilot.ai.grudgeId ??= null;
    pilot.ai.grudgeUntil ??= 0;
  }
  if (world.player.reputation) {
    const next = emptyRep();
    for (const [key, value] of Object.entries(world.player.reputation)) next[migrateFaction(key)] = value;
    world.player.reputation = next;
  }
  const known = migrateFaction(String(world.player.origin?.race ?? world.player.faction));
  const race = known === 'human' || known === 'zhargi' || known === 'taeyori' || known === 'virex' || known === 'kvissae' ? known : 'human';
  if (world.player.origin) world.player.origin.race = race;
  world.player.origin ??= makeOrigin(race, 'explorer', 1);
  world.player.skills ??= { ...world.player.origin.skills };
  world.player.xp ??= 0;
  world.player.spent ??= 0;
  world.player.proficiency ??= careerProficiency(world.player.origin.career);
  world.player.visited ??= [world.player.systemId];
  world.player.pendingDock ??= null;
  world.player.pendingJump ??= null;
  world.player.locked ??= [];
  world.player.locker ??= {};
  world.player.reputation ??= emptyRep();
  const fitHull = () => {
    const hull = HULL_BY_ID[world.player.ship.hullId] ? world.player.ship.hullId : 'iskra';
    world.player.ship.hullId = hull;
    const n = slotLayout(hullOf(hull)).length;
    while (world.player.ship.modules.length < n) world.player.ship.modules.push(null);
    while (world.player.ship.online.length < n) world.player.ship.online.push(true);
    while (world.player.ship.cycles.length < n) world.player.ship.cycles.push(0);
    world.player.ship.modules.length = n;
    world.player.ship.online.length = n;
    world.player.ship.cycles.length = n;
  };
  fitHull();
  world.events ??= [];
  world.wrecks ??= [];
  world.rumors ??= [];
  world.pings ??= [];
  world.missions ??= [];
  return world;
}

export function step(world: World, commands: Command[]): void {
  world.tick += 1;
  world.time = Math.round((world.time + SIM_DT) * 1000) / 1000;
  for (const command of commands) applyCommand(world, command);
  syncOrbits(world, SIM_DT);
  stickDockedPlayer(world);
  resolveFollow(world, world.player);
  for (const pilot of world.pilots) {
    if (!pilot.destroyed) resolveFollow(world, pilot);
  }
  updateEvents(world);
  for (const station of world.stations) tickMarket(station, world.events, SIM_DT);
  updateWars(world, SIM_DT);
  updateAI(world, SIM_DT);
  for (const pilot of world.pilots) if (!pilot.destroyed) pilot.combatTimer = Math.max(0, pilot.combatTimer - SIM_DT);
  world.player.combatTimer = Math.max(0, world.player.combatTimer - SIM_DT);

  const prevSystem = world.player.systemId;
  for (const pilot of world.pilots) {
    if (pilot.destroyed || pilot.dockedAt) continue;
    const ew = ewarAgainst(world, pilot.id);
    const fit = fitOf(pilot, ew.scram);
    updateMotion(world, pilot, SIM_DT, ew.scram, ew.web, fit.speed, fit.mass);
  }
  if (!world.player.dockedAt) {
    const ew = ewarAgainst(world, world.player.id);
    const fit = fitOf(world.player, ew.scram);
    updateMotion(world, world.player, SIM_DT, ew.scram, ew.web, fit.speed, fit.mass);
  }
  const groups = new Map<string, Body[]>();
  const add = (b: Body) => {
    if (b.dockedAt || b.jump) return;
    const list = groups.get(b.systemId) ?? [];
    list.push(b);
    groups.set(b.systemId, list);
  };
  for (const pilot of world.pilots) if (!pilot.destroyed) add(pilot);
  add(world.player);
  for (const list of groups.values()) separateBodies(list);

  if (!world.player.dockedAt && !world.player.jump) {
    const track = HULL_TRACK[world.player.ship.hullId];
    if (track) grantProf(world, track, 1.2 * SIM_DT);
  }
  if (world.player.systemId !== prevSystem) onPlayerArrived(world);
  resolvePending(world);
  resolveDocking(world);
  maybeAutoJump(world);
  runCombat(world);
  updateMissions(world);
  expireWorld(world);
  for (const pilot of world.pilots) {
    if (pilot.destroyed && world.time >= pilot.respawnAt) revivePilot(world, pilot);
  }
  const reinforceEvery = world.settings?.invaders === 'sleeping' ? 36 : world.settings?.invaders === 'tide' ? 12 : 22;
  const reinforceWindow = Math.floor(world.time / reinforceEvery);
  if (reinforceWindow !== world.lastReinforceWindow) {
    world.lastReinforceWindow = reinforceWindow;
    if (world.time > 20) reinforce(world);
  }
  if (world.pings.length > 36) world.pings.splice(0, world.pings.length - 36);
  if (world.rumors.length > 14) world.rumors.splice(0, world.rumors.length - 14);
}

function stickDockedPlayer(world: World): void {
  if (!world.player.dockedAt) return;
  const st = stationById(world, world.player.dockedAt);
  if (!st) return;
  world.player.x = st.x;
  world.player.y = st.y;
  world.player.systemId = st.systemId;
  world.player.vx = 0;
  world.player.vy = 0;
}

function resolveFollow(world: World, body: Body): void {
  const id = body.nav.followId;
  if (!id) return;
  if (id.startsWith('gate:')) {
    const to = id.slice(5);
    const gate = systemById(world, body.systemId)?.gates.find((g) => g.to === to);
    if (gate) {
      body.nav.x = gate.x;
      body.nav.y = gate.y;
    }
    return;
  }
  const planet = planetById(world, id);
  if (planet && planet.systemId === body.systemId) {
    body.nav.x = planet.x;
    body.nav.y = planet.y;
    return;
  }
  const station = stationById(world, id);
  if (station && station.systemId === body.systemId) {
    body.nav.x = station.x;
    body.nav.y = station.y;
    return;
  }
  const target = findBody(world, id);
  if (!target || target.systemId !== body.systemId || target.dockedAt || target.jump) return;
  body.nav.x = target.x;
  body.nav.y = target.y;
}

function onPlayerArrived(world: World): void {
  const sys = systemById(world, world.player.systemId);
  pushLog(world, `Выход в системе ${sys?.name ?? world.player.systemId}.`);
  if (!world.player.visited.includes(world.player.systemId)) {
    world.player.visited.push(world.player.systemId);
    const explore = world.player.skills ? skillBonus(world.player.skills, world.player.origin?.race ?? 'kvissae').explore : 1;
    grantXp(world, 22 * explore);
  }
  const route = world.player.route;
  if (route && route[world.player.routeIndex + 1] === world.player.systemId) {
    world.player.routeIndex += 1;
    if (world.player.routeIndex >= route.length - 1) world.player.route = null;
    else world.player.autoJumpAt = world.time + 1.6;
  }
}

function resolvePending(world: World): void {
  const player = world.player;
  if (player.dockedAt || player.jump || player.docking) return;
  if (player.pendingDock) beginDock(world, player.pendingDock, true);
  else if (player.pendingJump) beginGate(world, player.pendingJump, true);
}

function resolveDocking(world: World): void {
  const docking = world.player.docking;
  if (!docking) return;
  if (world.player.combatTimer > 0) {
    world.player.docking = null;
    pushLog(world, 'Попадание срывает стыковку.');
    return;
  }
  if (docking.t >= docking.duration) {
    world.player.dockedAt = docking.stationId;
    world.player.lastStationId = docking.stationId;
    world.player.docking = null;
    world.player.pendingDock = null;
    world.player.vx = 0;
    world.player.vy = 0;
    world.player.locked = [];
    world.player.lock = null;
    world.player.warp = null;
    const st = stationById(world, docking.stationId);
    pushLog(world, `Стыковка: ${st?.name ?? 'док'}.`);
    if (st) pushLog(world, dockGreeting(st.owner, st.name));
  }
}

function maybeAutoJump(world: World): void {
  const player = world.player;
  if (!player.route || player.jump || player.dockedAt || player.docking) return;
  if (world.time < player.autoJumpAt || player.combatTimer > 0) return;
  if (ewarAgainst(world, player.id).scram) return;
  if (player.route[player.routeIndex] !== player.systemId) {
    const dest = player.route[player.route.length - 1];
    if (!dest) {
      player.route = null;
      return;
    }
    const path = findPath(world, player.systemId, dest);
    if (!path) {
      player.route = null;
      return;
    }
    player.route = path;
    player.routeIndex = 0;
  }
  const next = player.route[player.routeIndex + 1];
  if (!next) {
    player.route = null;
    return;
  }
  startJump(world, next, false);
}

function applyCommand(world: World, command: Command): void {
  const player = world.player;
  switch (command.t) {
    case 'dest':
      if (player.dockedAt || player.jump) return;
      player.nav = { mode: command.mode, x: command.x, y: command.y, range: command.range, followId: command.followId };
      player.pendingDock = null;
      player.pendingJump = null;
      player.warp = null;
      return;
    case 'stop':
      player.nav.mode = 'stop';
      player.nav.followId = null;
      player.pendingDock = null;
      player.pendingJump = null;
      player.warp = null;
      player.docking = null;
      return;
    case 'select':
      player.selectedId = command.id;
      return;
    case 'lock':
      beginLock(world);
      return;
    case 'unlockAll':
      player.locked = [];
      player.lock = null;
      return;
    case 'toggleModule':
      toggleModule(world, command.index);
      return;
    case 'jump':
      startJump(world, command.systemId, true);
      return;
    case 'useGate':
      beginGate(world, command.systemId, false);
      return;
    case 'setRoute':
      setRoute(world, command.systemId);
      return;
    case 'cancelJump':
      if (player.jump && player.jump.progress < 0.45) {
        player.jump = null;
        pushLog(world, 'Разгон прерван.');
      }
      return;
    case 'dock':
      beginDock(world, command.stationId, false);
      return;
    case 'undock':
      undock(world);
      return;
    case 'buy':
      tradeBuy(world, command.goodId, command.qty);
      return;
    case 'sell':
      tradeSell(world, command.goodId, command.qty);
      return;
    case 'buyMod':
      buyModule(world, command.moduleId);
      return;
    case 'sellMod':
      sellModule(world, command.moduleId);
      return;
    case 'fit':
      fitModule(world, command.moduleId, command.index);
      return;
    case 'unfit':
      unfitModule(world, command.index);
      return;
    case 'buyHull':
      buyHull(world, command.hullId);
      return;
    case 'repair':
      repair(world);
      return;
    case 'train':
      trainSkill(world, command.skill);
      return;
    case 'acceptMission':
      acceptMission(world, command.id);
      return;
    case 'loot':
      loot(world, command.wreckId);
      return;
    default:
      return;
  }
}

function beginLock(world: World): void {
  const player = world.player;
  const id = player.selectedId;
  if (!id) return;
  if (player.locked.includes(id) || player.lock?.id === id) return;
  const target = findBody(world, id);
  if (!target || target.systemId !== player.systemId || target.dockedAt || target.jump) {
    pushLog(world, 'Цель вне досягаемости захвата.');
    return;
  }
  const fit = fitOf(player);
  if (player.locked.length >= fit.maxLocked) {
    pushLog(world, 'Нет свободных каналов захвата.');
    return;
  }
  if (dist(player.x, player.y, target.x, target.y) > fit.lockRange) {
    pushLog(world, 'Цель дальше дистанции захвата.');
    return;
  }
  const sig = fitOf(target).sig;
  player.lock = { id, t: 0, need: lockSeconds(fit.scanRes, sig) };
}

function toggleModule(world: World, index: number): void {
  const ship = world.player.ship;
  const layout = slotLayout(hullOf(ship.hullId));
  if (index < 0 || index >= layout.length) return;
  if (layout[index] === 'rig') return;
  if (!ship.modules[index]) return;
  ship.online[index] = !ship.online[index];
}

function startJump(world: World, to: string, manual: boolean): boolean {
  const player = world.player;
  if (player.jump) return false;
  if (!isNeighbor(world, player.systemId, to)) {
    if (manual) pushLog(world, 'Нет прямого гиперканала.');
    return false;
  }
  if (player.combatTimer > 0) {
    if (manual) pushLog(world, 'Бой держит корпус — прыжок рано.');
    return false;
  }
  if (!player.dockedAt && ewarAgainst(world, player.id).scram) {
    if (manual) pushLog(world, 'Фиксатор срывает разгон.');
    return false;
  }
  player.dockedAt = null;
  player.docking = null;
  player.pendingDock = null;
  player.pendingJump = null;
  player.warp = null;
  player.jump = { to, from: player.systemId, progress: 0, duration: jumpDuration(world, player.systemId, to) };
  player.nav.mode = 'stop';
  const name = systemById(world, to)?.name ?? to;
  pushLog(world, `Прыжок к ${name}.`);
  return true;
}

function beginGate(world: World, to: string, quiet: boolean): void {
  const player = world.player;
  if (player.dockedAt || player.jump) return;
  const gate = systemById(world, player.systemId)?.gates.find((g) => g.to === to);
  if (!gate) return;
  player.pendingDock = null;
  player.pendingJump = to;
  if (dist(player.x, player.y, gate.x, gate.y) < 380) startJump(world, to, true);
  else {
    player.nav = { mode: 'approach', x: gate.x, y: gate.y, range: 140, followId: `gate:${to}` };
    if (!quiet) pushLog(world, 'Идём к вратам.');
  }
}

function beginDock(world: World, stationId: string, quiet: boolean): void {
  const player = world.player;
  const st = stationById(world, stationId);
  if (!st || player.jump) return;
  if (player.dockedAt === stationId) return;
  if (st.systemId !== player.systemId) {
    pushLog(world, 'Док в другой системе.');
    return;
  }
  if (st.owner === 'omnir' || (st.owner !== 'free' && (player.reputation[st.owner] ?? 0) < -40)) {
    pushLog(world, `${st.name} не открывает шлюз.`);
    player.pendingDock = null;
    return;
  }
  player.pendingJump = null;
  player.pendingDock = stationId;
  const speed = Math.hypot(player.vx, player.vy);
  if (player.combatTimer > 0) {
    if (!quiet) pushLog(world, 'В бою стыковка закрыта.');
    return;
  }
  if (dist(player.x, player.y, st.x, st.y) < 210 && speed < 140) {
    player.docking = { stationId, t: 0, duration: 2.2 };
    player.pendingDock = null;
    player.warp = null;
    player.nav = { mode: 'stop', x: st.x, y: st.y, range: 0, followId: null };
    pushLog(world, 'Шлюз принимает корабль.');
  } else if (!player.docking) {
    player.nav = { mode: 'approach', x: st.x, y: st.y, range: 90, followId: st.id };
  }
}

function undock(world: World): void {
  const player = world.player;
  if (!player.dockedAt) return;
  const st = stationById(world, player.dockedAt);
  player.dockedAt = null;
  player.docking = null;
  if (st) {
    player.x = st.x + 180;
    player.y = st.y;
    player.systemId = st.systemId;
    player.vx = 30;
    player.vy = 0;
  }
  player.nav = { mode: 'approach', x: player.x + 400, y: player.y, range: 0, followId: null };
  pushLog(world, 'Отход от дока.');
}

function setRoute(world: World, systemId: string | null): void {
  const player = world.player;
  if (!systemId) {
    player.route = null;
    pushLog(world, 'Маршрут снят.');
    return;
  }
  if (systemId === player.systemId) {
    pushLog(world, 'Вы уже в этой системе.');
    return;
  }
  const path = findPath(world, player.systemId, systemId);
  if (!path) {
    pushLog(world, 'Каналы туда не ведут.');
    return;
  }
  player.route = path;
  player.routeIndex = 0;
  const names = path.map((id) => systemById(world, id)?.name ?? id).join(' → ');
  pushLog(world, `Маршрут: ${names}.`);
  const next = path[1];
  if (next) startJump(world, next, true);
}

function dockedStation(world: World) {
  return world.player.dockedAt ? stationById(world, world.player.dockedAt) : undefined;
}

function noteTrade(world: World, faction: FactionId, credits: number): void {
  if (!LIVING_FACTIONS.includes(faction)) return;
  const bag = world.player.tradeScore;
  bag[faction] = (bag[faction] ?? 0) + credits;
  while ((bag[faction] ?? 0) >= 4000) {
    bag[faction] -= 4000;
    bumpRep(world, faction, 1);
  }
}

function tradeBuy(world: World, goodId: string, qty: number): void {
  const st = dockedStation(world);
  if (!st || !GOOD_BY_ID[goodId]) return;
  const fit = fitOf(world.player);
  const free = Math.max(0, fit.cargo - cargoUsed(world.player.cargo));
  const swing = economyVolatility(world.settings?.economy);
  const bought = buyGoods(st, goodId, Math.min(qty, free), world.events, !!systemById(world, st.systemId)?.challenger, world.player.credits, swing);
  if (bought.qty <= 0) {
    pushLog(world, 'Покупка не прошла: деньги, трюм или запас.');
    return;
  }
  const mood = world.player.skills ? skillBonus(world.player.skills, world.player.origin?.race ?? 'kvissae') : null;
  const pay = Math.round(bought.credits * (mood?.tradeBuy ?? 1) * dockDiscount(world, st.owner));
  world.player.credits -= pay;
  grantXp(world, pay / 160);
  world.player.cargo[goodId] = (world.player.cargo[goodId] ?? 0) + bought.qty;
  noteTrade(world, st.owner, bought.credits);
  pushLog(world, `Куплено ${bought.qty} × ${GOOD_BY_ID[goodId]!.name} за ${bought.credits}.`);
}

function tradeSell(world: World, goodId: string, qty: number): void {
  const st = dockedStation(world);
  if (!st || !GOOD_BY_ID[goodId]) return;
  const have = world.player.cargo[goodId] ?? 0;
  const swing = economyVolatility(world.settings?.economy);
  const sold = sellGoods(st, goodId, Math.min(qty, have), world.events, !!systemById(world, st.systemId)?.challenger, swing);
  if (sold.qty <= 0) return;
  world.player.cargo[goodId] = have - sold.qty;
  if ((world.player.cargo[goodId] ?? 0) <= 0) delete world.player.cargo[goodId];
  const mood = world.player.skills ? skillBonus(world.player.skills, world.player.origin?.race ?? 'kvissae') : null;
  const gain = Math.round(sold.credits * (mood?.tradeSell ?? 1));
  world.player.credits += gain;
  grantXp(world, gain / 160);
  noteTrade(world, st.owner, sold.credits);
  pushLog(world, `Продано ${sold.qty} × ${GOOD_BY_ID[goodId]!.name} за ${sold.credits}.`);
}

function dockDiscount(world: World, faction: FactionId): number {
  const rank = rankOf(world.player.reputation[faction] ?? 0).level;
  const charm = world.player.skills?.charm ?? 0;
  return Math.max(0.72, 1 - 0.018 * Math.max(0, rank - 1) - 0.012 * charm);
}

function priceOfModule(world: World, base: number, stationOwner: FactionId): number {
  const rep = world.player.reputation[stationOwner] ?? 0;
  return Math.max(1, Math.round(base * (1 - clamp(rep, -40, 40) / 220) * dockDiscount(world, stationOwner)));
}

function gateMessage(world: World, kind: 'hull' | 'mod', id: string, tech: number, faction: FactionId): string | null {
  if (kind === 'hull') {
    const text = gateText(world.player.proficiency ?? {}, HULL_GATES[id] ?? []);
    if (text) return `Нужно освоение: ${text}.`;
    const need = HULL_RANK[id] ?? 0;
    const have = rankOf(world.player.reputation[faction] ?? 0);
    if (have.level < need) {
      const name = RANKS.find((r) => r.level === need)?.name ?? String(need);
      return `Нужно звание «${name}» у хозяина дока.`;
    }
    return null;
  }
  const gate = weaponGate(id, tech);
  if (!gate) return null;
  const text = gateText(world.player.proficiency ?? {}, [gate]);
  return text ? `Нужно освоение: ${text}.` : null;
}

function buyModule(world: World, moduleId: string): void {
  const st = dockedStation(world);
  const def = MODULE_BY_ID[moduleId];
  if (!st || !def) return;
  const tech = stationTech(world, st);
  if (def.tech > tech) {
    pushLog(world, 'Верфь этого дока так не умеет.');
    return;
  }
  const blocked = gateMessage(world, 'mod', def.id, def.tech, st.owner);
  if (blocked) {
    pushLog(world, blocked);
    return;
  }
  const price = priceOfModule(world, def.price, st.owner);
  if (world.player.credits < price) {
    pushLog(world, 'Не хватает кредитов.');
    return;
  }
  world.player.credits -= price;
  world.player.locker[moduleId] = (world.player.locker[moduleId] ?? 0) + 1;
  pushLog(world, `${def.name} на складе корабля.`);
}

function sellModule(world: World, moduleId: string): void {
  const st = dockedStation(world);
  const def = MODULE_BY_ID[moduleId];
  if (!st || !def) return;
  if ((world.player.locker[moduleId] ?? 0) <= 0) return;
  world.player.locker[moduleId] -= 1;
  if (world.player.locker[moduleId] <= 0) delete world.player.locker[moduleId];
  const pay = Math.round(priceOfModule(world, def.price, st.owner) * 0.45);
  world.player.credits += pay;
  pushLog(world, `Склад: ${def.name} продан за ${pay}.`);
}

function fitModule(world: World, moduleId: string, index: number): void {
  if (!world.player.dockedAt) return;
  const def = MODULE_BY_ID[moduleId];
  if (!def || (world.player.locker[moduleId] ?? 0) <= 0) return;
  const ship = world.player.ship;
  const layout = slotLayout(hullOf(ship.hullId));
  if (index < 0 || index >= layout.length || layout[index] !== def.slot) {
    pushLog(world, 'Модуль не встаёт в этот слот.');
    return;
  }
  const blocked = gateMessage(world, 'mod', def.id, def.tech, 'free');
  if (blocked) {
    pushLog(world, blocked);
    return;
  }
  const prev = ship.modules[index] ?? null;
  ship.modules[index] = moduleId;
  const fit = computeFit(ship);
  if (!fit.valid) {
    ship.modules[index] = prev;
    pushLog(world, `Не влезает: ${fit.reason}.`);
    return;
  }
  world.player.locker[moduleId] -= 1;
  if (world.player.locker[moduleId] <= 0) delete world.player.locker[moduleId];
  if (prev) world.player.locker[prev] = (world.player.locker[prev] ?? 0) + 1;
  ship.online[index] = true;
  ship.cycles[index] = 0;
  clampPools(world.player);
  pushLog(world, `${def.name} установлен.`);
}

function unfitModule(world: World, index: number): void {
  if (!world.player.dockedAt) return;
  const ship = world.player.ship;
  const id = ship.modules[index];
  if (!id) return;
  ship.modules[index] = null;
  ship.online[index] = false;
  world.player.locker[id] = (world.player.locker[id] ?? 0) + 1;
  clampPools(world.player);
}

function buyHull(world: World, hullId: string): void {
  const st = dockedStation(world);
  const hull = HULL_BY_ID[hullId];
  if (!st || !hull) return;
  if (hull.tech > stationTech(world, st)) {
    pushLog(world, 'Этот корпус собирают на верфи старше.');
    return;
  }
  const blocked = gateMessage(world, 'hull', hull.id, hull.tech, st.owner);
  if (blocked) {
    pushLog(world, blocked);
    return;
  }
  const old = HULL_BY_ID[world.player.ship.hullId];
  const price = priceOfModule(world, hull.price, st.owner);
  const refund = Math.round((old?.price ?? 0) * 0.45);
  if (world.player.credits + refund < price) {
    pushLog(world, 'Не хватает кредитов на корпус.');
    return;
  }
  const moved = transferFit(hullId, world.player.ship.modules);
  for (const id of moved.leftover) world.player.locker[id] = (world.player.locker[id] ?? 0) + 1;
  world.player.credits += refund - price;
  world.player.ship = freshShip(hullId, moved.modules);
  const grown = fitOf(world.player);
  world.player.ship.shield = grown.maxShield;
  world.player.ship.armor = grown.maxArmor;
  world.player.ship.hull = grown.maxHull;
  world.player.ship.cap = grown.maxCap;
  world.player.insuranceHull = hullId;
  pushLog(world, `Новый корпус: ${hull.name}. Сдача за старый ${refund}.`);
}

function repair(world: World): void {
  if (!world.player.dockedAt) return;
  const ship = world.player.ship;
  const fit = fitOf(world.player);
  const repairMul = world.player.skills ? skillBonus(world.player.skills, world.player.origin?.race ?? 'kvissae').repair : 1;
  const cost = Math.ceil(
    (Math.max(0, fit.maxShield - ship.shield) * 1.2 +
      Math.max(0, fit.maxArmor - ship.armor) * 2.5 +
      Math.max(0, fit.maxHull - ship.hull) * 7) *
      repairMul,
  );
  if (cost <= 0) return;
  if (world.player.credits < cost) {
    pushLog(world, `Ремонт стоит ${cost}, на счету меньше.`);
    return;
  }
  world.player.credits -= cost;
  ship.shield = fit.maxShield;
  ship.armor = fit.maxArmor;
  ship.hull = fit.maxHull;
  pushLog(world, `Корпус цел. Списано ${cost}.`);
}

function loot(world: World, wreckId: string): void {
  const player = world.player;
  if (player.dockedAt || player.jump) return;
  const wreck = world.wrecks.find((w) => w.id === wreckId && w.systemId === player.systemId);
  if (!wreck) return;
  if (dist(player.x, player.y, wreck.x, wreck.y) > 180) return;
  const fit = fitOf(player);
  for (const [good, qty] of Object.entries(wreck.cargo)) {
    let left = qty;
    while (left > 0 && cargoUsed(player.cargo) < fit.cargo) {
      player.cargo[good] = (player.cargo[good] ?? 0) + 1;
      left -= 1;
    }
    if (left > 0) wreck.cargo[good] = left;
    else delete wreck.cargo[good];
  }
  for (const mod of [...wreck.modules]) {
    player.locker[mod] = (player.locker[mod] ?? 0) + 1;
  }
  wreck.modules = [];
  player.credits += wreck.credits;
  wreck.credits = 0;
  if (Object.keys(wreck.cargo).length === 0) world.wrecks = world.wrecks.filter((w) => w.id !== wreck.id);
  pushLog(world, `Подбор с ${wreck.name}.`);
}

function acceptMission(world: World, id: string): void {
  const mission = world.missions.find((m) => m.id === id && m.status === 'offer');
  if (!mission || world.player.dockedAt !== mission.stationId) return;
  const owner = stationById(world, mission.stationId)?.owner ?? 'free';
  const have = rankOf(world.player.reputation[owner] ?? 0).level;
  if (have < (mission.minRank ?? 0)) {
    pushLog(world, 'Для этого контракта не хватает звания у хозяина дока.');
    return;
  }
  if (mission.type === 'deliver') {
    const qty = mission.qty;
    const good = mission.goodId ?? 'ore';
    if (cargoFree(world.player.ship, world.player.cargo) < qty) {
      pushLog(world, 'В трюме нет места под контракт.');
      return;
    }
    world.player.cargo[good] = (world.player.cargo[good] ?? 0) + qty;
    mission.status = 'active';
    mission.expires = world.time + 900;
    pushLog(world, `Контракт принят: ${mission.title}.`);
    return;
  }
  if (mission.type === 'kill') {
    const origin = stationById(world, mission.stationId);
    const sys = origin ? systemById(world, origin.systemId) : undefined;
    const neigh = [...(sys?.links ?? [])]
      .map((sid) => systemById(world, sid))
      .filter((s): s is StarSystem => !!s)
      .sort((a, b) => a.security - b.security || a.id.localeCompare(b.id))[0];
    const where = neigh ?? sys;
    if (!where) return;
    const pirate = spawnPilot(world, {
      faction: 'pirate',
      role: 'pirate',
      systemId: where.id,
      tier: where.security < 0.25 ? 2 : 1,
      x: 1200,
      y: 600,
      name: `Главарь ${where.name}`,
      homeSystemId: where.id,
    });
    pirate.ai.state = 'hunt';
    pirate.ai.targetId = 'player';
    mission.targetPilotId = pirate.id;
    mission.status = 'active';
    mission.expires = world.time + 900;
    mission.desc = `${mission.desc} Цель объявилась в системе ${where.name}.`;
    pushLog(world, `Охота открыта: ${pirate.name} в системе ${where.name}.`);
    return;
  }
  const origin = stationById(world, mission.stationId);
  const dest = mission.destStationId ? stationById(world, mission.destStationId) : undefined;
  if (!origin || !dest) return;
  const path = findPath(world, origin.systemId, dest.systemId) ?? [origin.systemId];
  const escort = spawnPilot(world, {
    faction: origin.owner === 'free' ? 'kvissae' : origin.owner,
    role: 'trader',
    systemId: origin.systemId,
    tier: 1,
    dockedAt: origin.id,
    homeStationId: origin.id,
    homeSystemId: origin.systemId,
    escortMissionId: mission.id,
    name: `Конвой «${origin.name}»`,
  });
  escort.ai.destSystemId = dest.systemId;
  escort.ai.stationId = dest.id;
  escort.ai.route = path;
  escort.ai.routeIndex = 0;
  escort.ai.timer = 12;
  escort.ai.state = 'dock';
  const mid = path[Math.min(path.length - 1, 1)] ?? origin.systemId;
  const ambush = spawnPilot(world, {
    faction: 'pirate',
    role: 'pirate',
    systemId: mid,
    tier: 1,
    x: 400,
    y: -900,
    homeSystemId: mid,
    name: 'Засада трассы',
  });
  ambush.ai.state = 'hunt';
  ambush.ai.targetId = escort.id;
  mission.escortPilotId = escort.id;
  mission.status = 'active';
  mission.expires = world.time + 900;
  pushLog(world, 'Конвой прогревает двигатели. Не отставайте.');
}

function updateEvents(world: World): void {
  world.events = world.events.filter((e) => e.endsAt > world.time);
  const window = Math.floor(world.time / 28);
  if (window === world.lastEventWindow) return;
  world.lastEventWindow = window;
  if (world.time < 25 || world.events.length >= 3) return;
  const invaderGate = world.settings?.invaders === 'sleeping' ? 0.4 : world.settings?.invaders === 'tide' ? 0.9 : 0.72;
  if (unit(world.seed, window, 9) > invaderGate) return;
  const systems = [...world.systems].sort((a, b) => a.id.localeCompare(b.id));
  const sys = systems[Math.floor(unit(world.seed, window, 10) * systems.length)];
  if (!sys) return;
  const kinds: GameEvent['kind'][] = ['epidemic', 'shortage', 'boom', 'raid', 'incursion', 'crisis'];
  const kind = kinds[Math.floor(unit(world.seed, window, 11) * kinds.length)]!;
  const good = ['meds', 'food', 'fuel', 'cells', 'iso', 'plates'][Math.floor(unit(world.seed, window, 12) * 6)]!;
  const text = eventText(kind, sys.name, good);
  const event: GameEvent = {
    id: `e${window}-${sys.id}`,
    kind,
    systemId: sys.id,
    goodId: kind === 'shortage' ? good : null,
    endsAt: world.time + 180,
    text,
  };
  world.events.push(event);
  world.rumors.push({ id: event.id, text, systemId: sys.id, time: world.time });
  pushLog(world, text);
  if (kind === 'raid' && sys.security < 0.75) {
    for (let i = 0; i < 2; i++) {
      spawnPilot(world, { faction: 'pirate', role: 'pirate', systemId: sys.id, tier: 1, x: 300 + i * 200, y: 800, homeSystemId: sys.id });
    }
  }
  if (kind === 'incursion' && world.settings?.invaders !== 'sleeping' && sys.owner !== 'omnir' && sys.security < (world.settings?.invaders === 'tide' ? 0.82 : 0.62)) {
    sys.challenger = 'omnir';
    sys.warScore = Math.min(100, sys.warScore + 18);
    for (let i = 0; i < 2; i++) {
      spawnPilot(world, {
        faction: 'omnir',
        role: 'invader',
        systemId: sys.id,
        tier: 2,
        x: -500,
        y: i * 240,
        homeSystemId: sys.id,
      });
    }
  }
}

function eventText(kind: GameEvent['kind'], systemName: string, good: string): string {
  const g = GOOD_BY_ID[good]?.name ?? good;
  switch (kind) {
    case 'epidemic':
      return `Эпидемия в системе ${systemName}: медикаменты дорожают, цеха встают.`;
    case 'shortage':
      return `Дефицит в системе ${systemName}: ${g}.`;
    case 'boom':
      return `Промышленный бум в системе ${systemName}. Сплав и пластины дешевеют.`;
    case 'raid':
      return `Налёт Ржавых клинков на систему ${systemName}.`;
    case 'incursion':
      return `Омнир вскрывает систему ${systemName}.`;
    case 'crisis':
      return `Кризис поставок в системе ${systemName}.`;
    default:
      return `Событие в системе ${systemName}.`;
  }
}

function updateWars(world: World, dt: number): void {
  for (const sys of world.systems) {
    if (!sys.challenger || sys.challenger === sys.owner) continue;
    let own = sys.stationIds.length ? 18 : 0;
    let chal = 0;
    for (const pilot of pilotsInSystem(world, sys.id)) {
      const power = Math.max(8, computeFit(pilot.ship).dps) * (pilot.dockedAt ? 0.35 : 1);
      if (pilot.faction === sys.owner) own += power;
      else if (pilot.faction === sys.challenger) chal += power;
    }
    const player = world.player;
    if (player.systemId === sys.id && !player.dockedAt && !player.jump) {
      const side = favoredSide(world, sys);
      const power = Math.max(8, fitOf(player).dps);
      if (side === sys.owner) own += power;
      else if (side === sys.challenger) chal += power;
    }
    sys.warScore = clamp(sys.warScore + (chal - own) * dt * 0.02, -120, 120);
    if (sys.warScore > 100) flipSystem(world, sys, sys.challenger);
  }
}

function favoredSide(world: World, sys: StarSystem): FactionId | null {
  let best: FactionId | null = null;
  let score = 12;
  const sides = [sys.owner, sys.challenger].filter((f): f is FactionId => !!f);
  for (const f of sides) {
    const rep = world.player.reputation[f] ?? 0;
    if (rep > score) {
      score = rep;
      best = f;
    }
  }
  return best;
}

function flipSystem(world: World, sys: StarSystem, next: FactionId): void {
  const prev = sys.owner;
  sys.prevOwner = prev;
  sys.owner = next;
  sys.warScore = 0;
  sys.challenger = prev === next ? null : prev;
  if (next === 'omnir') sys.security = 0.05;
  else if (prev === 'omnir') sys.security = 0.42;
  for (const id of sys.stationIds) {
    const st = stationById(world, id);
    if (st) st.owner = next;
  }
  pushLog(world, `${sys.name} переходит к ${FACTION_NAME[next]}.`);
}

function runCombat(world: World): void {
  const bodies: Body[] = [world.player, ...world.pilots.filter((p) => !p.destroyed)];
  for (const body of bodies) {
    if (body.jump) continue;
    for (let i = 0; i < body.ship.cycles.length; i++) body.ship.cycles[i] = Math.max(0, (body.ship.cycles[i] ?? 0) - SIM_DT);
    const ew = ewarAgainst(world, body.id);
    const fit = fitOf(body, ew.scram);
    body.ship.shield = clamp(body.ship.shield, 0, fit.maxShield);
    body.ship.armor = clamp(body.ship.armor, 0, fit.maxArmor);
    body.ship.hull = clamp(body.ship.hull, 0, fit.maxHull);
    body.ship.cap = clamp(body.ship.cap + (fit.capRegen - fit.passiveCap) * SIM_DT, 0, fit.maxCap);
    if (!body.dockedAt) {
      body.ship.shield = Math.min(fit.maxShield, body.ship.shield + fit.shieldRegen * SIM_DT);
      body.ship.armor = Math.min(fit.maxArmor, body.ship.armor + fit.armorRegen * SIM_DT);
      const people = body.id === 'player' ? world.player.origin?.race : body.faction;
      if (people === 'taeyori') {
        body.ship.shield = Math.min(fit.maxShield, body.ship.shield + fit.maxShield * 0.012 * SIM_DT);
        body.ship.armor = Math.min(fit.maxArmor, body.ship.armor + fit.maxArmor * 0.005 * SIM_DT);
        body.ship.hull = Math.min(fit.maxHull, body.ship.hull + fit.maxHull * 0.002 * SIM_DT);
        body.ship.cap = Math.min(fit.maxCap, body.ship.cap + fit.maxCap * 0.004 * SIM_DT);
      }
    }
  }
  advanceLock(world);
  const player = world.player;
  if (!player.dockedAt && !player.jump) {
    const tid = player.selectedId && player.locked.includes(player.selectedId) ? player.selectedId : player.locked[0];
    const target = tid ? findBody(world, tid) : undefined;
    if (target) shoot(world, player, target);
    else maintainRepairs(world, player);
  }
  const pilots = world.pilots.filter((p) => !p.destroyed).sort((a, b) => a.id.localeCompare(b.id));
  for (const pilot of pilots) {
    if (pilot.dockedAt || pilot.jump || !pilot.ai.targetId) {
      maintainRepairs(world, pilot);
      continue;
    }
    const target = findBody(world, pilot.ai.targetId);
    if (!target || target.systemId !== pilot.systemId || target.dockedAt || target.jump) {
      pilot.ai.targetId = null;
      maintainRepairs(world, pilot);
      continue;
    }
    if (pilot.faction === target.faction && pilot.faction !== 'free') {
      pilot.ai.targetId = null;
      continue;
    }
    shoot(world, pilot, target);
  }
  if (world.player.ship.hull <= 0 && !world.player.dockedAt && !world.player.jump) killPlayer(world);
  for (const pilot of world.pilots) {
    if (!pilot.destroyed && pilot.ship.hull <= 0) killPilot(world, pilot);
  }
}

function advanceLock(world: World): void {
  const player = world.player;
  if (player.lock && !player.dockedAt && !player.jump) {
    const tgt = findBody(world, player.lock.id);
    const fit = fitOf(player);
    if (!tgt || tgt.systemId !== player.systemId || tgt.dockedAt || dist(player.x, player.y, tgt.x, tgt.y) > fit.lockRange * 1.05) {
      player.lock = null;
    } else {
      player.lock.t += SIM_DT;
      if (player.lock.t >= player.lock.need) {
        if (!player.locked.includes(tgt.id) && player.locked.length < fit.maxLocked) {
          player.locked.push(tgt.id);
          pushLog(world, `Захват: ${tgt.name}.`);
        }
        player.lock = null;
      }
    }
  }
  player.locked = player.locked.filter((id) => {
    const tgt = findBody(world, id);
    if (!tgt || tgt.systemId !== player.systemId || tgt.dockedAt || tgt.jump) return false;
    const fit = fitOf(player);
    return dist(player.x, player.y, tgt.x, tgt.y) <= fit.lockRange * 1.2;
  });
}

function maintainRepairs(world: World, body: Body): void {
  if (body.dockedAt || body.jump) return;
  const ew = ewarAgainst(world, body.id);
  const fit = fitOf(body, ew.scram);
  cycleRepairs(body, fit);
}

function cycleRepairs(body: Body, fit: ReturnType<typeof computeFit>): void {
  for (const rep of fit.repairs) {
    if (!rep.online) continue;
    if ((body.ship.cycles[rep.index] ?? 0) > 0) continue;
    const cur = rep.layer === 'shield' ? body.ship.shield : body.ship.armor;
    const max = rep.layer === 'shield' ? fit.maxShield : fit.maxArmor;
    if (cur >= max - 1 || body.ship.cap < rep.cap) continue;
    body.ship.cap -= rep.cap;
    if (rep.layer === 'shield') body.ship.shield = Math.min(max, cur + rep.hp);
    else body.ship.armor = Math.min(max, cur + rep.hp);
    body.ship.cycles[rep.index] = rep.cycle;
  }
}

function shoot(world: World, attacker: Body, target: Body): void {
  const ewA = ewarAgainst(world, attacker.id);
  const fit = fitOf(attacker, ewA.scram);
  cycleRepairs(attacker, fit);
  const ewT = ewarAgainst(world, target.id);
  const tFit = fitOf(target, ewT.scram);
  const distance = dist(attacker.x, attacker.y, target.x, target.y);
  const trans = transversal(attacker.x, attacker.y, attacker.vx, attacker.vy, target.x, target.y, target.vx, target.vy);
  const sig = tFit.sig * ewT.painter;
  for (const weapon of fit.weapons) {
    if (!weapon.online) continue;
    if ((attacker.ship.cycles[weapon.index] ?? 0) > 0) continue;
    if (attacker.ship.cap < weapon.cap) continue;
    attacker.ship.cap -= weapon.cap;
    attacker.ship.cycles[weapon.index] = weapon.cycle;
    const aim = attacker.id === 'player' ? Math.min(1.5, 1 + 0.06 * ((attacker as Player).skills?.aim ?? 0)) : 1;
    const allies = attacker.id === 'player'
      ? pilotsInSystem(world, attacker.systemId).filter((p) => !p.dockedAt && p.faction === attacker.faction).length
      : 0;
    const lead = 1 + 0.03 * Math.min(3, allies);
    const appl = Math.min(1, application(distance, weapon.optimal, weapon.falloff, weapon.tracking, sig, trans) * aim);
    if (attacker.id === 'player') {
      const mid = attacker.ship.modules[weapon.index];
      const group = mid ? WEAPON_GROUP[mid] : undefined;
      if (group) grantProf(world, group, appl >= 0.08 ? 14 : 5);
    }
    if (appl < 0.08) continue;
    const amount = weapon.dps * weapon.cycle * appl * (attacker.id === 'player' ? lead : 1);
    applyDamage(target.ship, tFit, amount, weapon.type, target.faction === 'omnir');
    if (target.faction === 'zhargi' && target.id !== 'player') {
      const hurt = world.pilots.find((p) => p.id === target.id);
      if (hurt) {
        hurt.ai.grudgeId = attacker.id;
        hurt.ai.grudgeUntil = world.time + 240;
      }
    }
    attacker.combatTimer = Math.max(attacker.combatTimer, 10);
    target.combatTimer = Math.max(target.combatTimer, 10);
    if (attacker.id === 'player') {
      grantXp(world, amount * 0.12);
      blamePlayer(world, target);
    }
    world.pings.push({
      time: world.time,
      systemId: target.systemId,
      x: target.x,
      y: target.y,
      text: String(Math.max(1, Math.round(amount))),
      color: FACTION_SHOT[attacker.faction] ?? DTYPE_COLOR[weapon.type],
      kind: 'hit',
      fromX: attacker.x,
      fromY: attacker.y,
    });
  }
}

function blamePlayer(world: World, target: Body): void {
  if (target.id === 'player') return;
  const pilot = world.pilots.find((p) => p.id === target.id);
  if (!pilot) return;
  pilot.lastHitBy = 'player';
  if (!pilot.hitByPlayer) {
    pilot.hitByPlayer = true;
    if (pilot.faction !== 'pirate' && pilot.faction !== 'omnir') bumpRep(world, pilot.faction, -6);
    callForHelp(world, pilot, 'player');
  }
}

function killPlayer(world: World): void {
  const player = world.player;
  const mods: string[] = [];
  player.ship.modules.forEach((id, index) => {
    if (id && unit(world.seed, world.tick, index, 9) > 0.5) mods.push(id);
  });
  world.wrecks.push({
    id: `w${world.tick}`,
    name: `Обломки ${player.name}`,
    systemId: player.systemId,
    x: player.x,
    y: player.y,
    cargo: { ...player.cargo },
    modules: mods,
    credits: 0,
    expiresAt: world.time + 120,
  });
  const hull = HULL_BY_ID[player.ship.hullId];
  const insurance = player.ship.hullId === 'iskra' ? 2000 : Math.round((hull?.price ?? 8000) * 0.3);
  player.credits += insurance;
  player.cargo = {};
  player.ship = freshShip('iskra', STARTER_FIT);
  const station =
    (player.lastStationId ? stationById(world, player.lastStationId) : undefined) ??
    world.stations.find((s) => s.owner !== 'omnir') ??
    world.stations[0];
  if (station) {
    player.dockedAt = station.id;
    player.lastStationId = station.id;
    player.systemId = station.systemId;
    player.x = station.x;
    player.y = station.y;
  }
  player.vx = 0;
  player.vy = 0;
  player.jump = null;
  player.warp = null;
  player.docking = null;
  player.locked = [];
  player.lock = null;
  player.selectedId = null;
  player.combatTimer = 0;
  player.route = null;
  player.pendingDock = null;
  player.pendingJump = null;
  player.nav.mode = 'stop';
  world.pings.push({ time: world.time, systemId: player.systemId, x: player.x, y: player.y, text: 'корпус', color: '#ff6b5a', kind: 'explode' });
  pushLog(world, `Корпус разрушен. Страховка ${insurance}. Вы очнулись на «Искре».`);
}

function killPilot(world: World, pilot: Pilot): void {
  if (pilot.destroyed) return;
  pilot.destroyed = true;
  pilot.respawnAt = world.time + 70 + (strHash(pilot.id) % 35);
  const killer = pilot.lastHitBy;
  const mods: string[] = [];
  pilot.ship.modules.forEach((id, index) => {
    if (id && unit(world.seed, world.tick, strHash(pilot.id), index) > 0.42) mods.push(id);
  });
  world.wrecks.push({
    id: `w${pilot.id}-${world.tick}`,
    name: `Обломки ${pilot.name}`,
    systemId: pilot.systemId,
    x: pilot.x,
    y: pilot.y,
    cargo: { ...pilot.cargo },
    modules: mods,
    credits: killer === 'player' ? 0 : Math.round(pilot.credits * 0.1),
    expiresAt: world.time + 100,
  });
  world.pings.push({
    time: world.time,
    systemId: pilot.systemId,
    x: pilot.x,
    y: pilot.y,
    text: 'взрыв',
    color: '#ffb15a',
    kind: 'explode',
  });
  pilot.dockedAt = null;
  pilot.jump = null;
  pilot.ai.targetId = null;
  pilot.cargo = {};
  if (killer === 'player') {
    const bountyMul = world.player.skills ? skillBonus(world.player.skills, world.player.origin?.race ?? 'kvissae').bounty : 1;
    const bounty = Math.round((700 + pilot.tier * 1200 + Math.round((HULL_BY_ID[pilot.ship.hullId]?.price ?? 0) * 0.03)) * bountyMul);
    grantXp(world, 36 + pilot.tier * 14);
    world.player.credits += bounty;
    world.player.kills += 1;
    if (pilot.faction === 'pirate') {
      livingRep(world, 4);
      bumpRep(world, 'pirate', -8);
    } else if (pilot.faction === 'omnir') livingRep(world, 6);
    else {
      bumpRep(world, pilot.faction, -14);
      livingRep(world, -3, pilot.faction);
      bumpRep(world, 'pirate', 6);
    }
    pushLog(world, `${pilot.name} уничтожен. Награда ${bounty}.`);
  }
}

function updateMissions(world: World): void {
  for (const mission of [...world.missions]) {
    if (mission.status === 'offer' && mission.expires < world.time) mission.status = 'failed';
    if (mission.status !== 'active') continue;
    if (mission.expires < world.time) {
      failMission(world, mission, 'Срок контракта вышел.');
      continue;
    }
    if (mission.type === 'deliver') {
      const good = mission.goodId ?? '';
      if (world.player.dockedAt && world.player.dockedAt === mission.destStationId && (world.player.cargo[good] ?? 0) >= mission.qty) {
        world.player.cargo[good] -= mission.qty;
        if ((world.player.cargo[good] ?? 0) <= 0) delete world.player.cargo[good];
        completeMission(world, mission);
      }
    } else if (mission.type === 'kill') {
      const tgt = world.pilots.find((p) => p.id === mission.targetPilotId);
      if (tgt?.destroyed && tgt.lastHitBy === 'player') completeMission(world, mission);
      else if (tgt?.destroyed) failMission(world, mission, 'Цель погибла без вашего выстрела.');
      else if (!tgt) failMission(world, mission, 'Цель пропала.');
    } else if (mission.type === 'escort') {
      const escort = world.pilots.find((p) => p.id === mission.escortPilotId);
      if (!escort || escort.destroyed) {
        failMission(world, mission, 'Конвой потерян.');
        continue;
      }
      if (world.player.systemId === escort.systemId && !world.player.jump) mission.witnessed = true;
      if (escort.dockedAt && escort.dockedAt === mission.destStationId) {
        if (mission.witnessed) completeMission(world, mission);
        else failMission(world, mission, 'Конвой дошёл без вас.');
        escort.ai.escortMissionId = null;
        escort.role = 'trader';
      }
    }
  }
  world.missions = world.missions.filter((m) => m.status === 'offer' || m.status === 'active');
  ensureOffers(world);
}

function completeMission(world: World, mission: Mission): void {
  mission.status = 'done';
  const mood = world.player.skills ? skillBonus(world.player.skills, world.player.origin?.race ?? 'kvissae') : null;
  const reward = Math.round(mission.reward * (mood?.reward ?? 1));
  world.player.credits += reward;
  bumpRep(world, mission.repFaction, mission.repAmount);
  grantXp(world, 48);
  pushLog(world, `Контракт закрыт: +${reward}.`);
}

function trainSkill(world: World, skill: SkillId): void {
  const skills = world.player.skills;
  if (!skills) return;
  const unspent = pointsEarned(world.player.xp) - world.player.spent;
  if (unspent <= 0) {
    pushLog(world, 'Нет свободных очков.');
    return;
  }
  if (skills[skill] >= 5) {
    pushLog(world, 'Навык уже на потолке.');
    return;
  }
  skills[skill] += 1;
  world.player.spent += 1;
  pushLog(world, `Навык усилен. Свободно очков: ${pointsEarned(world.player.xp) - world.player.spent}.`);
}

function failMission(world: World, mission: Mission, why: string): void {
  mission.status = 'failed';
  pushLog(world, `Контракт сорван. ${why}`);
}

function ensureOffers(world: World): void {
  const dock = world.player.dockedAt;
  if (!dock) return;
  const offers = world.missions.filter((m) => m.status === 'offer' && m.stationId === dock);
  let guard = 0;
  while (offers.length < 3 && guard < 5) {
    guard += 1;
    const mission = makeOffer(world, dock, offers.length + guard * 17);
    if (!mission) break;
    if (mission.reward >= 7000) mission.minRank = 3;
    else if (mission.reward >= 5200) mission.minRank = 2;
    world.missions.push(mission);
    offers.push(mission);
  }
}

function makeOffer(world: World, stationId: string, salt: number): Mission | null {
  const station = stationById(world, stationId);
  if (!station) return null;
  const roll = unit(world.seed, world.tick, strHash(stationId), salt);
  const kind = roll < 0.48 ? 'deliver' : roll < 0.78 ? 'kill' : 'escort';
  const others = world.stations
    .filter((s) => s.id !== station.id && s.owner !== 'omnir')
    .map((s) => ({ s, path: findPath(world, station.systemId, s.systemId) }))
    .filter((x) => x.path && x.path.length >= 2 && x.path.length <= 4)
    .sort((a, b) => a.s.id.localeCompare(b.s.id));
  if (!others.length) return null;
  const dest = others[Math.floor(unit(world.seed, salt, 3) * others.length)]!;
  const repFaction = station.owner === 'free' || station.owner === 'pirate' || station.owner === 'omnir' ? 'kvissae' : station.owner;
  const id = `m${world.tick}-${salt}-${stationId}`;
  if (kind === 'deliver') {
    const goods = ['alloy', 'meds', 'cells', 'plates', 'fuel', 'food'];
    const good = goods[Math.floor(unit(world.seed, salt, 4) * goods.length)]!;
    const qty = 8 + Math.floor(unit(world.seed, salt, 5) * 14);
    const hops = (dest.path?.length ?? 2) - 1;
    return {
      id,
      type: 'deliver',
      status: 'offer',
      stationId,
      title: `Доставка: ${GOOD_BY_ID[good]!.name}`,
      desc: `Отвезите ${qty} ед. на ${dest.s.name}. Груз выдадут при подписи.`,
      reward: 1600 + qty * (GOOD_BY_ID[good]!.base * 0.35) + hops * 500,
      repFaction,
      repAmount: 4,
      expires: world.time + 240,
      goodId: good,
      qty: Math.round(qty),
      destStationId: dest.s.id,
      destSystemId: dest.s.systemId,
      targetPilotId: null,
      escortPilotId: null,
      witnessed: false,
    minRank: 0,
    };
  }
  if (kind === 'kill') {
    return {
      id,
      type: 'kill',
      status: 'offer',
      stationId,
      title: 'Снять главаря налёта',
      desc: 'Ржавые клинки душат соседнюю трассу. Уничтожьте их главаря лично.',
      reward: 5200 + Math.round(unit(world.seed, salt, 6) * 2800),
      repFaction,
      repAmount: 6,
      expires: world.time + 240,
      goodId: null,
      qty: 0,
      destStationId: null,
      destSystemId: null,
      targetPilotId: null,
      escortPilotId: null,
      witnessed: false,
    minRank: 0,
    };
  }
  return {
    id,
    type: 'escort',
    status: 'offer',
    stationId,
    title: `Сопроводить конвой до ${dest.s.name}`,
    desc: 'Торговец боится засады. Держитесь рядом, пока он не встанет в док.',
    reward: 4800 + ((dest.path?.length ?? 2) - 1) * 700,
    repFaction,
    repAmount: 5,
    expires: world.time + 240,
    goodId: null,
    qty: 0,
    destStationId: dest.s.id,
    destSystemId: dest.s.systemId,
    targetPilotId: null,
    escortPilotId: null,
    witnessed: false,
    minRank: 0,
  };
}

function expireWorld(world: World): void {
  world.wrecks = world.wrecks.filter((w) => w.expiresAt > world.time);
}

function clampPools(body: Body): void {
  const fit = fitOf(body);
  body.ship.shield = clamp(body.ship.shield, 0, fit.maxShield);
  body.ship.armor = clamp(body.ship.armor, 0, fit.maxArmor);
  body.ship.hull = clamp(body.ship.hull, 0, fit.maxHull);
  body.ship.cap = clamp(body.ship.cap, 0, fit.maxCap);
}

export function shipStats(body: Body) {
  const ew = { scrammed: false };
  return fitOf(body, ew.scrammed);
}
