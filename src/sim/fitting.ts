import { HULL_BY_ID, MODULE_BY_ID, slotLayout } from './content';
import { clamp } from './rng';
import type { DamageType, FitStats, HullDef, ModuleDef, PlayableRace, Resists, ShipInstance } from './types';
import { DAMAGE_TYPES } from './types';

export interface FitBonus {
  dmg: number;
  speed: number;
  shield: number;
  armor: number;
  cargo: number;
  scan: number;
  opt: number;
  pg: number;
  cpu: number;
  agility: number;
}

export interface FitOptions {
  scrammed?: boolean;
  bonus?: FitBonus;
  /** Народ пилота. Свои модули дают +10% к тому, что они делают. */
  race?: PlayableRace;
}

const AFFINITY: Record<string, PlayableRace> = {
  igla: 'human',
  igla2: 'human',
  oskol: 'human',
  rels: 'zhargi',
  plate: 'zhargi',
  plate2: 'zhargi',
  luch: 'kvissae',
  zhar: 'kvissae',
  korona: 'kvissae',
  plazma: 'kvissae',
  zhar2: 'taeyori',
  veil: 'taeyori',
  rosa: 'taeyori',
  shov: 'virex',
  klinch: 'virex',
  metka: 'virex',
  um: 'virex',
  tros: 'virex',
};

export function moduleAffinity(id: string): PlayableRace | undefined {
  return AFFINITY[id];
}

function affinityMul(id: string, race: PlayableRace | undefined): number {
  return race && AFFINITY[id] === race ? 1.1 : 1;
}

function emptyDps(): Record<DamageType, number> {
  return { em: 0, thermal: 0, kinetic: 0, explosive: 0 };
}

function copyRes(r: Resists): Resists {
  return { em: r.em, thermal: r.thermal, kinetic: r.kinetic, explosive: r.explosive };
}

function bump(r: Resists, add: number): void {
  for (const k of DAMAGE_TYPES) r[k] = clamp(r[k] + add, 0, 0.85);
}

export function hullOf(hullId: string): HullDef {
  const h = HULL_BY_ID[hullId];
  if (!h) throw new Error(`unknown hull ${hullId}`);
  return h;
}

export function freshShip(hullId: string, modules: (string | null)[]): ShipInstance {
  const hull = hullOf(hullId);
  const layout = slotLayout(hull);
  const mods = layout.map((_, i) => modules[i] ?? null);
  const online = mods.map((m) => m !== null);
  const cycles = mods.map(() => 0);
  const ship: ShipInstance = {
    hullId,
    modules: mods,
    online,
    cycles,
    shield: 1,
    armor: 1,
    hull: 1,
    cap: 1,
  };
  const fit = computeFit(ship);
  ship.shield = fit.maxShield;
  ship.armor = fit.maxArmor;
  ship.hull = fit.maxHull;
  ship.cap = fit.maxCap;
  return ship;
}

export function computeFit(ship: ShipInstance, opts: FitOptions = {}): FitStats {
  const hull = hullOf(ship.hullId);
  const layout = slotLayout(hull);
  const reason: string[] = [];
  const bonus = opts.bonus ?? { dmg: 1, speed: 1, shield: 1, armor: 1, cargo: 1, scan: 1, opt: 1, pg: 1, cpu: 1, agility: 1 };
  let pgUsed = 0;
  let cpuUsed = 0;
  let calUsed = 0;
  let pg = hull.pg * bonus.pg;
  let cpu = hull.cpu * bonus.cpu;
  let dmgMult = bonus.dmg;
  let cargoMult = bonus.cargo;
  let optMult = bonus.opt;
  let fallMult = 1;
  let capAdd = 0;
  let capRegenAdd = 0;
  let capRegenMult = 1;
  let shieldHp = hull.shield;
  let armorHp = hull.armor;
  let shieldRegen = hull.shieldRegen;
  let armorRegen = hull.armorRegen;
  const shieldResist = copyRes(hull.shieldResist);
  const armorResist = copyRes(hull.armorResist);
  const weapons: FitStats['weapons'] = [];
  const repairs: FitStats['repairs'] = [];
  const ewars: FitStats['ewars'] = [];
  let bestProp = 1;
  let propSig = 1;
  let propCap = 0;
  let propMwd = false;
  let propName = false;

  const n = layout.length;
  if (ship.modules.length < n || ship.online.length < n || ship.cycles.length < n) {
    reason.push('слоты корпуса не сходятся');
  }

  const fitted: { m: ModuleDef; index: number; on: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const id = ship.modules[i];
    if (!id) continue;
    const m = MODULE_BY_ID[id];
    if (!m) {
      reason.push('неизвестный модуль');
      continue;
    }
    if (m.slot !== layout[i]) reason.push(`${m.name} стоит не в своём слоте`);
    pgUsed += m.pg;
    cpuUsed += m.cpu;
    calUsed += m.cal;
    pg += m.pgAdd ?? 0;
    cpu += m.cpuAdd ?? 0;
    const on = ship.online[i] !== false;
    const kin = affinityMul(m.id, opts.race);
    if (m.slot !== 'rig' && !on) {
      fitted.push({ m, index: i, on });
      continue;
    }
    if (m.shieldHp) shieldHp += m.shieldHp * kin;
    if (m.armorHp) armorHp += m.armorHp * kin;
    if (m.shieldRegen) shieldRegen += m.shieldRegen * kin;
    if (m.armorRegen) armorRegen += m.armorRegen * kin;
    if (m.capAdd) capAdd += m.capAdd;
    if (m.capRegenAdd) capRegenAdd += m.capRegenAdd;
    if (m.capRegenMult) capRegenMult *= m.capRegenMult;
    if (m.dmgMult) dmgMult *= m.dmgMult;
    if (m.cargoMult) cargoMult *= m.cargoMult;
    if (m.optMult) optMult *= m.optMult;
    if (m.fallMult) fallMult *= m.fallMult;
    if (m.shieldResistAll) bump(shieldResist, m.shieldResistAll);
    if (m.armorResistAll) bump(armorResist, m.armorResistAll);
    fitted.push({ m, index: i, on });
  }

  for (const { m, index, on } of fitted) {
    if (m.speedMult && !m.weapon) {
      const killed = !!m.mwd && !!opts.scrammed;
      if (!killed && on) {
        bestProp = Math.max(bestProp, m.speedMult);
        propMwd = propMwd || !!m.mwd;
        propName = true;
        propSig *= m.sigMult ?? 1;
        propCap += m.capPerSec ?? 0;
      }
    }
    if (m.weapon) {
      weapons.push({
        index,
        name: m.name,
        dps: on ? m.weapon.dps * dmgMult * affinityMul(m.id, opts.race) : 0,
        type: m.weapon.type,
        optimal: m.weapon.optimal * optMult,
        falloff: m.weapon.falloff * fallMult,
        tracking: m.weapon.tracking,
        cycle: m.weapon.cycle,
        cap: m.weapon.cap,
        online: on,
      });
    }
    const kin = affinityMul(m.id, opts.race);
    if (m.repairShield) {
      repairs.push({ index, layer: 'shield', hp: m.repairShield.hp * kin, cycle: m.repairShield.cycle, cap: m.repairShield.cap, online: on });
    }
    if (m.repairArmor) {
      repairs.push({ index, layer: 'armor', hp: m.repairArmor.hp * kin, cycle: m.repairArmor.cycle, cap: m.repairArmor.cap, online: on });
    }
    if (m.web) ewars.push({ index, kind: 'web', amount: m.web.amount * kin, optimal: m.web.optimal, falloff: m.web.falloff, cycle: m.web.cycle, cap: m.web.cap, online: on });
    if (m.scram) ewars.push({ index, kind: 'scram', amount: 1, optimal: m.scram.optimal, falloff: m.scram.falloff, cycle: m.scram.cycle, cap: m.scram.cap, online: on });
    if (m.painter) {
      ewars.push({
        index,
        kind: 'painter',
        amount: m.painter.sig,
        optimal: m.painter.optimal,
        falloff: m.painter.falloff,
        cycle: m.painter.cycle,
        cap: m.painter.cap,
        online: on,
      });
    }
  }

  shieldHp *= bonus.shield;
  armorHp *= bonus.armor;
  if (opts.race === 'zhargi') {
    armorRegen += Math.max(3, hull.armor * 0.007);
    armorHp *= 1.22;
    shieldHp *= 0.72;
  }
  if (opts.race === 'taeyori') shieldRegen *= 1.45;
  if (opts.race === 'kvissae') {
    shieldHp *= 1.14;
    armorHp *= 0.82;
  }

  if (pgUsed > pg + 1e-6) reason.push(`сеть ${pgUsed}/${pg}`);
  if (cpuUsed > cpu + 1e-6) reason.push(`процессор ${cpuUsed}/${cpu}`);
  if (calUsed > hull.cal + 1e-6) reason.push(`калибровка ${calUsed}/${hull.cal}`);

  const dpsByType = emptyDps();
  let dps = 0;
  for (const w of weapons) {
    dpsByType[w.type] += w.dps;
    dps += w.dps;
  }

  return {
    valid: reason.length === 0,
    reason: reason.join('; '),
    pgUsed,
    cpuUsed,
    calUsed,
    pg,
    cpu,
    cal: hull.cal,
    maxShield: shieldHp,
    maxArmor: armorHp,
    maxHull: hull.hull,
    maxCap: hull.cap + capAdd,
    shieldRegen,
    armorRegen,
    capRegen: (hull.capRegen + capRegenAdd) * capRegenMult,
    speed: hull.speed * bestProp * bonus.speed,
    cargo: hull.cargo * cargoMult,
    sig: hull.sig * propSig,
    scanRes: hull.scanRes * bonus.scan,
    lockRange: hull.lockRange,
    maxLocked: hull.maxLocked,
    mass: hull.mass / Math.max(0.4, bonus.agility),
    shieldResist,
    armorResist,
    dps,
    dpsByType,
    passiveCap: propCap,
    weapons,
    repairs,
    ewars,
    prop: propName ? { speedMult: bestProp, sigMult: propSig, capPerSec: propCap, mwd: propMwd } : null,
  };
}

export function canFitModules(hullId: string, modules: (string | null)[]): { ok: boolean; reason: string } {
  const ship = freshShip(hullId, modules);
  const fit = computeFit(ship);
  return { ok: fit.valid, reason: fit.reason };
}

/** Greedy transfer of old modules onto a new hull. Returns leftover module ids. */
export function transferFit(hullId: string, previous: (string | null)[]): { modules: (string | null)[]; leftover: string[] } {
  const hull = hullOf(hullId);
  const layout = slotLayout(hull);
  const modules: (string | null)[] = layout.map(() => null);
  const leftover: string[] = [];
  for (const id of previous) {
    if (!id) continue;
    const def = MODULE_BY_ID[id];
    if (!def) continue;
    let placed = false;
    for (let i = 0; i < layout.length; i++) {
      if (modules[i] || layout[i] !== def.slot) continue;
      modules[i] = id;
      if (canFitModules(hullId, modules).ok) {
        placed = true;
        break;
      }
      modules[i] = null;
    }
    if (!placed) leftover.push(id);
  }
  return { modules, leftover };
}

export function cargoUsed(cargo: Record<string, number>): number {
  let s = 0;
  for (const k of Object.keys(cargo)) s += cargo[k] ?? 0;
  return s;
}

export function cargoFree(ship: ShipInstance, cargo: Record<string, number>): number {
  return Math.max(0, computeFit(ship).cargo - cargoUsed(cargo));
}

export function hpFraction(ship: ShipInstance): number {
  const fit = computeFit(ship);
  const max = fit.maxShield + fit.maxArmor + fit.maxHull;
  const cur = Math.max(0, ship.shield) + Math.max(0, ship.armor) + Math.max(0, ship.hull);
  return max <= 0 ? 0 : cur / max;
}
