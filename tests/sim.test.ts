import { describe, expect, it } from 'vitest';
import { GOODS, HULLS, MODULES, STARTER_FIT } from '../src/sim/content';
import { applyDamage } from '../src/sim/combat';
import { stationPrice } from '../src/sim/economy';
import { canFitModules, computeFit, freshShip } from '../src/sim/fitting';
import { LIVING_FACTIONS } from '../src/sim/types';
import { createWorld, step } from '../src/sim/world';
import { spawnPilot } from '../src/sim/ai';

function tick(world: ReturnType<typeof createWorld>, n: number, commands: Parameters<typeof step>[1] = []): void {
  for (let i = 0; i < n; i++) step(world, i === 0 ? commands : []);
}

describe('генерация', () => {
  it('одно зерно даёт одну и ту же галактику и тот же прогон', () => {
    const a = createWorld(4242, 'Тест');
    const b = createWorld(4242, 'Тест');
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    tick(a, 40, [{ t: 'undock' }]);
    tick(b, 40, [{ t: 'undock' }]);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('другое зерно двигает системы', () => {
    const a = createWorld(7, 'Тест');
    const c = createWorld(8, 'Тест');
    const sig = (w: ReturnType<typeof createWorld>) => w.systems.map((s) => `${s.name}:${s.x.toFixed(2)}`).join('|');
    expect(sig(a)).not.toEqual(sig(c));
  });

  it('карта связана и в ней есть пять народов и Омнир', () => {
    const w = createWorld(11, 'Тест');
    expect(w.systems.length).toBeGreaterThanOrEqual(28);
    const seen = new Set<string>([w.systems[0]!.id]);
    const q = [w.systems[0]!.id];
    while (q.length) {
      const id = q.pop()!;
      const sys = w.systems.find((s) => s.id === id)!;
      for (const n of sys.links) if (!seen.has(n)) {
        seen.add(n);
        q.push(n);
      }
    }
    expect(seen.size).toBe(w.systems.length);
    for (const f of LIVING_FACTIONS) expect(w.systems.some((s) => s.owner === f)).toBe(true);
    expect(w.systems.some((s) => s.owner === 'omnir')).toBe(true);
    expect(HULLS.length).toBeGreaterThanOrEqual(5);
    expect(MODULES.length).toBeGreaterThanOrEqual(25);
    expect(GOODS.map((g) => g.id)).toEqual(['fe', 'ni', 'ti', 'cu', 'al', 'w', 'pt', 'rare', 'he3', 'deuterium', 'crystals', 'biomass']);
    expect(HULLS.some((h) => h.id === 'zhargi_cruiser')).toBe(true);
    expect(HULLS.some((h) => h.id === 'omnir_carrier')).toBe(true);
  });
});

describe('экономика', () => {
  it('залповый слив роняет цену', () => {
    const w = createWorld(3, 'Тест');
    const st = w.stations.find((s) => s.id === w.player.dockedAt)!;
    const before = stationPrice(st, 'fe', w.events, false);
    w.player.cargo.fe = 500;
    step(w, [{ t: 'sell', goodId: 'fe', qty: 400 }]);
    const after = stationPrice(st, 'fe', w.events, false);
    expect(after).toBeLessThan(before * 0.85);
    expect(st.market.fe!.stock).toBeGreaterThan(400);
  });

  it('запасы живых рынков меняются сами', () => {
    const w = createWorld(5, 'Тест');
    const before = w.stations.reduce((s, st) => s + st.market.fe!.stock, 0);
    tick(w, 200);
    const after = w.stations.reduce((s, st) => s + st.market.fe!.stock, 0);
    expect(after).not.toBeCloseTo(before, 3);
  });
});

describe('фит', () => {
  it('стартовый набор «Искры» законен, усилитель входит в урон', () => {
    const ship = freshShip('iskra', STARTER_FIT);
    const fit = computeFit(ship);
    expect(fit.valid).toBe(true);
    expect(fit.weapons[0]!.dps).toBeCloseTo(24 * 1.15);
    expect(fit.speed).toBeCloseTo(340 * 1.62);
  });

  it('лишняя плита не проходит по энергосети', () => {
    const result = canFitModules('iskra', ['igla', 'luch', 'veil', 'poryv', 'plate', 'plate', null]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('сеть');
  });

  it('перебор процессора отвергается', () => {
    const mods = [
      'korona', 'korona', 'korona', 'korona', 'korona', 'korona',
      'veil2', 'veil2', 'veil2', 'veil2',
      'klin2', 'klin2', 'klin2', 'klin2', 'klin2',
      null, null, null,
    ];
    const result = canFitModules('monolit', mods);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('процессор');
  });
});

describe('бой и прыжок', () => {
  it('кинетика меньше снимает щит, чем ЭМ при тех же единицах урона', () => {
    const em = freshShip('iskra', STARTER_FIT);
    const kin = freshShip('iskra', STARTER_FIT);
    const fit = computeFit(em);
    applyDamage(em, fit, 100, 'em');
    applyDamage(kin, fit, 100, 'kinetic');
    expect(em.shield).toBeLessThan(kin.shield);
  });

  it('фиксатор рядом срывает прыжок, без него прыжок начинается', () => {
    const open = createWorld(9, 'Тест');
    open.player.dockedAt = null;
    open.player.combatTimer = 0;
    const neigh = open.systems.find((s) => s.id === open.player.systemId)!.links[0]!;
    step(open, [{ t: 'jump', systemId: neigh }]);
    expect(open.player.jump?.to).toBe(neigh);

    const blocked = createWorld(9, 'Тест');
    blocked.player.dockedAt = null;
    blocked.player.combatTimer = 0;
    const pirate = spawnPilot(blocked, {
      faction: 'pirate',
      role: 'pirate',
      systemId: blocked.player.systemId,
      tier: 1,
      x: blocked.player.x + 80,
      y: blocked.player.y,
    });
    pirate.ship = freshShip('iskra', ['igla', null, 'klinch', null, null, null, null]);
    pirate.ai.targetId = 'player';
    const dest = blocked.systems.find((s) => s.id === blocked.player.systemId)!.links[0]!;
    step(blocked, [{ t: 'jump', systemId: dest }]);
    expect(blocked.player.jump).toBeNull();
  });

  it('сродство Зхаргов усиливает рельсу, броня затягивается', () => {
    const ship = freshShip('iskra', ['rels', null, 'veil', 'poryv', 'plate', 'zapas', null]);
    const plain = computeFit(ship);
    const zh = computeFit(ship, { race: 'zhargi' });
    expect(zh.weapons[0]!.dps).toBeCloseTo(plain.weapons[0]!.dps * 1.1);
    expect(zh.armorRegen).toBeGreaterThan(plain.armorRegen);
    expect(zh.maxShield).toBeLessThan(plain.maxShield);
  });

  it('Омнир копит сопротивление к типу, которым его бьют', () => {
    const ship = freshShip('iskra', STARTER_FIT);
    const fit = computeFit(ship);
    applyDamage(ship, fit, 40, 'thermal', true);
    expect(ship.adapt?.thermal ?? 0).toBeGreaterThan(0.04);
  });

  it('после сотен тиков нет NaN', () => {
    const w = createWorld(21, 'Тест');
    tick(w, 300);
    expect(Number.isFinite(w.player.x)).toBe(true);
    expect(w.pilots.every((p) => Number.isFinite(p.x) && Number.isFinite(p.ship.hull))).toBe(true);
  });
});
