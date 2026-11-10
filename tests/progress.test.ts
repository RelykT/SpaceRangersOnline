import { describe, expect, it } from 'vitest';
import { canFitModules } from '../src/sim/fitting';
import { CAREERS } from '../src/sim/origin';
import { HULL_GATES, gateText, pointsEarned, profLevel, weaponGate } from '../src/sim/progress';
import { createWorld, step } from '../src/sim/world';

describe('навыки и освоение', () => {
  it('карьера только даёт старт: корпус можно летать, очки ещё не потрачены', () => {
    for (const career of CAREERS) {
      const fit = canFitModules(career.hullId, career.modules);
      expect(fit.ok, career.id + fit.reason).toBe(true);
    }
    const trader = createWorld(4, 'Тест', { race: 'vekt', career: 'trader', portrait: 3 });
    expect(trader.player.ship.hullId).toBe('korob');
    expect(trader.player.skills.trade).toBeGreaterThan(0);
    expect(trader.player.spent).toBe(0);
    expect(gateText(trader.player.proficiency, HULL_GATES.klinok ?? [])).toBeTruthy();
    const soldier = createWorld(4, 'Тест', { race: 'regnar', career: 'soldier' });
    expect(soldier.player.ship.hullId).toBe('klinok');
    expect(gateText(soldier.player.proficiency, HULL_GATES.klinok ?? [])).toBeNull();
    expect(soldier.player.faction).toBe('regnar');
    expect(systemHome(soldier)).toBe('regnar');
  });

  it('очко навыка тратится и не запирает другие ветки', () => {
    const world = createWorld(6, 'Тест', { career: 'explorer' });
    world.player.xp = 80;
    const before = world.player.skills.aim;
    step(world, [{ t: 'train', skill: 'aim' }]);
    expect(world.player.skills.aim).toBe(before + 1);
    expect(world.player.spent).toBe(1);
    expect(world.player.skills.trade).toBeGreaterThanOrEqual(0);
  });

  it('полёт на корпусе копится в его освоении', () => {
    const world = createWorld(8, 'Тест', { career: 'explorer' });
    world.player.dockedAt = null;
    const before = world.player.proficiency['hull.scout'] ?? 0;
    for (let i = 0; i < 40; i++) step(world, []);
    expect(world.player.proficiency['hull.scout'] ?? 0).toBeGreaterThan(before);
  });

  it('второе поколение орудия просит уровень освоения', () => {
    expect(weaponGate('rels', 2)).toEqual({ track: 'wep.rail', level: 2 });
    expect(weaponGate('igla', 1)).toBeNull();
    expect(profLevel(120)).toBe(2);
    expect(pointsEarned(80)).toBe(1);
    expect(pointsEarned(0)).toBe(0);
  });

  it('размер края и шторм цен отличаются от спокойных настроек', () => {
    const small = createWorld(15, 'Тест', { settings: { size: 'small', difficulty: 'calm', invaders: 'sleeping', economy: 'flat' } });
    const large = createWorld(15, 'Тест', { settings: { size: 'large', difficulty: 'harsh', invaders: 'tide', economy: 'storm' } });
    expect(small.systems.length).toBeLessThan(large.systems.length);
    expect(small.systems.filter((s) => s.owner === 'absolute').length).toBeLessThanOrEqual(
      large.systems.filter((s) => s.owner === 'absolute').length,
    );
  });
});

function systemHome(world: ReturnType<typeof createWorld>): string | null {
  return world.systems.find((s) => s.id === world.player.systemId)?.home ?? null;
}
