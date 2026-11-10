/** Thresholds that separate a tap, a drag, and a long-press. */

export const GESTURE = {
  mouseDragPx: 8,
  touchDragPx: 14,
  longPressMs: 450,
  longPressSlopPx: 12,
} as const;

export type PointerKind = 'mouse' | 'touch' | 'pen';

export type GestureName = 'pending' | 'tap' | 'drag' | 'longpress' | 'pinch';

export interface GestureSample {
  pointerType: PointerKind;
  movedPx: number;
  heldMs: number;
  released: boolean;
  pointers: number;
}

export function dragThreshold(pointerType: PointerKind): number {
  return pointerType === 'mouse' ? GESTURE.mouseDragPx : GESTURE.touchDragPx;
}

/**
 * Classify one pointer sample.
 * Two or more contacts are always a pinch/pan, never a tap.
 * A long-press wins only for touch/pen that stayed inside the slop.
 */
export function classifyGesture(sample: GestureSample): GestureName {
  if (sample.pointers >= 2) return 'pinch';
  const dragPx = dragThreshold(sample.pointerType);
  const canLongPress = sample.pointerType !== 'mouse';
  if (!sample.released && canLongPress && sample.heldMs >= GESTURE.longPressMs && sample.movedPx <= GESTURE.longPressSlopPx) {
    return 'longpress';
  }
  if (sample.movedPx > dragPx) return 'drag';
  if (!sample.released) return 'pending';
  if (sample.heldMs >= GESTURE.longPressMs && canLongPress && sample.movedPx <= GESTURE.longPressSlopPx) return 'longpress';
  return 'tap';
}
