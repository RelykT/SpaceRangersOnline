import { describe, expect, it } from 'vitest';
import { GESTURE, classifyGesture } from '../src/input/gestures';
import { HIT_PX, hitRadiusPx, pickAt, worldPointerAllowed, worldToScreen, type Camera, type Pickable, type Rect } from '../src/input/pick';

const cam: Camera = { x: 0, y: 0, zoom: 0.2, viewW: 800, viewH: 600 };

function at(item: Pickable): { x: number; y: number } {
  return worldToScreen(cam, item.x, item.y);
}

describe('попадание по объектам', () => {
  const tiny: Pickable = { id: 'ship-a', kind: 'ship', name: 'Искра', x: 0, y: 0, spriteRadius: 2 };
  const other: Pickable = { id: 'ship-b', kind: 'ship', name: 'Клинок', x: 150, y: 0, spriteRadius: 2 };

  it('даёт крошечному спрайту зону не меньше 44px на сенсоре', () => {
    expect(hitRadiusPx(2, cam.zoom, HIT_PX.touch)).toBe(HIT_PX.touch);
    const center = at(tiny);
    const hit = pickAt(cam, [tiny], center.x + 20, center.y, HIT_PX.touch);
    expect(hit.map((h) => h.item.id)).toEqual(['ship-a']);
    const miss = pickAt(cam, [tiny], center.x + 50, center.y, HIT_PX.touch);
    expect(miss).toHaveLength(0);
  });

  it('не угадывает, если под пальцем несколько объектов', () => {
    const center = at(tiny);
    const hits = pickAt(cam, [tiny, other], center.x + 10, center.y, HIT_PX.touch);
    expect(hits.map((h) => h.item.id).sort()).toEqual(['ship-a', 'ship-b']);
    expect(hits[0]!.item.id).toBe('ship-a');
    expect(hits[0]!.distancePx).toBeLessThan(hits[1]!.distancePx);
  });

  it('зона мыши тоже не схлопывается до размера спрайта', () => {
    expect(hitRadiusPx(1, 0.05, HIT_PX.mouse)).toBe(HIT_PX.mouse);
  });

  it('большой спрайт можно ткнуть по краю картинки', () => {
    const planet: Pickable = { id: 'p', kind: 'planet', name: 'Сад', x: 0, y: 0, spriteRadius: 400 };
    const radius = hitRadiusPx(400, cam.zoom, HIT_PX.touch);
    expect(radius).toBeGreaterThan(HIT_PX.touch);
    const center = at(planet);
    expect(pickAt(cam, [planet], center.x + radius - 2, center.y, HIT_PX.touch)).toHaveLength(1);
  });
});

describe('панели перехватывают ввод', () => {
  const canvas: Rect = { x: 0, y: 0, w: 800, h: 600 };
  const overview: Rect = { x: 600, y: 48, w: 200, h: 500 };
  const modules: Rect = { x: 0, y: 520, w: 800, h: 80 };

  it('клик по обзору и по слотам не доходит до космоса', () => {
    expect(worldPointerAllowed({ x: 640, y: 120 }, canvas, [overview, modules])).toBe(false);
    expect(worldPointerAllowed({ x: 40, y: 560 }, canvas, [overview, modules])).toBe(false);
  });

  it('клик по пустому космосу доходит', () => {
    expect(worldPointerAllowed({ x: 200, y: 200 }, canvas, [overview, modules])).toBe(true);
    expect(worldPointerAllowed({ x: 900, y: 20 }, canvas, [overview, modules])).toBe(false);
  });
});

describe('жест: касание, перетаскивание, долгое нажатие', () => {
  it('короткий сдвиг пальца ещё касание', () => {
    expect(classifyGesture({ pointerType: 'touch', movedPx: 6, heldMs: 120, released: true, pointers: 1 })).toBe('tap');
  });

  it('сдвиг дальше порога — перетаскивание, даже если палец уже отпущен', () => {
    expect(classifyGesture({ pointerType: 'mouse', movedPx: GESTURE.mouseDragPx + 1, heldMs: 80, released: true, pointers: 1 })).toBe('drag');
    expect(classifyGesture({ pointerType: 'touch', movedPx: GESTURE.touchDragPx + 2, heldMs: 200, released: true, pointers: 1 })).toBe('drag');
  });

  it('удержание пальца без сдвига — долгое нажатие, мышь так не делает', () => {
    expect(
      classifyGesture({ pointerType: 'touch', movedPx: 3, heldMs: GESTURE.longPressMs, released: false, pointers: 1 }),
    ).toBe('longpress');
    expect(
      classifyGesture({ pointerType: 'mouse', movedPx: 2, heldMs: 800, released: true, pointers: 1 }),
    ).toBe('tap');
  });

  it('два пальца всегда щипок, а не приказ кораблю', () => {
    expect(classifyGesture({ pointerType: 'touch', movedPx: 2, heldMs: 40, released: false, pointers: 2 })).toBe('pinch');
  });
});
