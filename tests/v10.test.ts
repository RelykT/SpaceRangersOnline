import { describe, expect, it } from 'vitest';
import { hullBulk, crowdRadius } from '../src/sim/content';
import { bearsOn, gameplayArc, noseBearing, wave } from '../src/render/rigmath';
import { v10ShipId } from '../src/render/v10map';

describe('риг v10', () => {
  it('синус, открытие и покачивание совпадают со спецификацией', () => {
    expect(wave({ type: 'sin', amp_deg: 10, cycles_per_loop: 1, phase_rad: 0 }, 0.25)[0]).toBeCloseTo(10);
    expect(wave({ type: 'open', amp_deg: 8, cycles_per_loop: 1, phase_rad: 0 }, 0)[0]).toBeCloseTo(0);
    expect(wave({ type: 'open', amp_deg: 8, cycles_per_loop: 1, phase_rad: 0 }, 0.5)[0]).toBeCloseTo(8);
    const bob = wave({ type: 'bob', amp_deg: 4, dx: 0.02, dy: -0.01, cycles_per_loop: 1, phase_rad: 0 }, 0);
    expect(bob[0]).toBeCloseTo(0);
    expect(bob[1]).toBeCloseTo(0.02);
  });

  it('игровой сектор уже манифеста: борт не смотрит назад', () => {
    expect(gameplayArc('right')).toEqual([-30, 110]);
    expect(gameplayArc('left')).toEqual([-110, 30]);
    expect(gameplayArc('center')).toEqual([-120, 120]);
    expect(bearsOn(20, 'right')).toBe(true);
    expect(bearsOn(150, 'right')).toBe(false);
    expect(bearsOn(-90, 'left')).toBe(true);
    expect(bearsOn(140, 'center')).toBe(false);
    expect(noseBearing(0, 0, 1, 0, 10, 0)).toBeCloseTo(0);
    expect(noseBearing(0, 0, 1, 0, 0, 10)).toBeCloseTo(90);
  });

  it('капитал не больше 3.8 истребителя, и корпуса расходятся по размеру', () => {
    expect(hullBulk('monolit')).toBeLessThanOrEqual(3.8);
    expect(hullBulk('omnir_carrier')).toBeLessThanOrEqual(3.8);
    expect(crowdRadius('iskra') + crowdRadius('monolit')).toBeGreaterThan(200);
  });

  it('корпуса народов смотрят на новые спрайты, у Омнир грузовоз — носитель', () => {
    expect(v10ShipId('human', 'iskra')).toBe('human_fighter');
    expect(v10ShipId('zhargi', 'oplot')).toBe('zhargi_battleship');
    expect(v10ShipId('zhargi', 'monolit')).toBe('zhargi_citadel');
    expect(v10ShipId('zhargi', 'zhargi_cruiser')).toBe('zhargi_cruiser');
    expect(v10ShipId('omnir', 'korob')).toBe('omnir_carrier');
    expect(v10ShipId('omnir', 'oplot')).toBe('omnir_cruiser');
    expect(v10ShipId('omnir', 'monolit')).toBe('omnir_dreadnought');
    expect(v10ShipId('taeyori', 'monolit')).toBe('teyori_ark');
    expect(v10ShipId('virex', 'monolit')).toBe('vireks_flagship');
    expect(v10ShipId('kvissae', 'klinok')).toBe('kvissae_frigate');
  });
});
