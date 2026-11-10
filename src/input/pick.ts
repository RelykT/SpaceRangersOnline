/** Screen-space picking. Pure: no DOM. Sprite size never shrinks the hit area below the minimum. */

export const Y_SQUASH = 0.82;

export const HIT_PX = {
  mouse: 28,
  touch: 44,
} as const;

export type PickKind = 'ship' | 'planet' | 'station' | 'gate' | 'wreck' | 'star';

export interface Pickable {
  id: string;
  kind: PickKind;
  name: string;
  x: number;
  y: number;
  /** Visual radius in world units. Hit testing still uses at least `minRadiusPx`. */
  spriteRadius: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  viewW: number;
  viewH: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface PickHit {
  item: Pickable;
  screenX: number;
  screenY: number;
  distancePx: number;
  radiusPx: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function worldToScreen(cam: Camera, x: number, y: number): ScreenPoint {
  return {
    x: (x - cam.x) * cam.zoom + cam.viewW / 2,
    y: (y - cam.y) * cam.zoom * Y_SQUASH + cam.viewH / 2,
  };
}

export function screenToWorld(cam: Camera, sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - cam.viewW / 2) / cam.zoom + cam.x,
    y: (sy - cam.viewH / 2) / (cam.zoom * Y_SQUASH) + cam.y,
  };
}

export function hitRadiusPx(spriteRadius: number, zoom: number, minRadiusPx: number): number {
  const visual = Math.abs(spriteRadius * zoom);
  return Math.max(minRadiusPx, visual);
}

/**
 * Every object whose hit disc contains the pointer, closest first.
 * Overlaps are all returned — the caller shows a picker instead of guessing.
 */
export function pickAt(cam: Camera, objects: Pickable[], sx: number, sy: number, minRadiusPx: number): PickHit[] {
  const hits: PickHit[] = [];
  for (const item of objects) {
    const p = worldToScreen(cam, item.x, item.y);
    const radius = hitRadiusPx(item.spriteRadius, cam.zoom, minRadiusPx);
    const dx = sx - p.x;
    const dy = sy - p.y;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx <= radius + 0.01) {
      hits.push({ item, screenX: p.x, screenY: p.y, distancePx, radiusPx: radius });
    }
  }
  hits.sort((a, b) => a.distancePx - b.distancePx || kindOrder(a.item.kind) - kindOrder(b.item.kind) || (a.item.id < b.item.id ? -1 : 1));
  return hits;
}

function kindOrder(kind: PickKind): number {
  switch (kind) {
    case 'ship':
      return 0;
    case 'station':
      return 1;
    case 'gate':
      return 2;
    case 'wreck':
      return 3;
    case 'planet':
      return 4;
    default:
      return 5;
  }
}

/** True only when the point is on the world surface and not inside a UI panel. */
export function worldPointerAllowed(point: ScreenPoint, canvas: Rect, blockers: Rect[]): boolean {
  if (!contains(canvas, point)) return false;
  for (const blocker of blockers) {
    if (contains(blocker, point)) return false;
  }
  return true;
}

export function contains(rect: Rect, point: ScreenPoint): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.w && point.y < rect.y + rect.h;
}
