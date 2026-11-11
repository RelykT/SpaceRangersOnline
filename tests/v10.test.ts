import { describe, expect, it } from 'vitest';
import { clampArc, wave } from '../src/render/rigmath';
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

  it('сектор турели не пускает ствол за спину в покое', () => {
    expect(clampArc(180, -170, 30)).toBe(-170);
    expect(clampArc(-10, -170, 30)).toBe(-10);
    expect(clampArc(200, -30, 170)).toBe(170);
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
