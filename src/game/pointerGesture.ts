import type { CardDropPlacement } from './handOrder';

export interface PointerDragState {
  active: boolean;
  cardId: string;
  placement: CardDropPlacement;
  startX: number;
  startY: number;
  targetId: string;
}

export interface PointerDragUpdate {
  started: boolean;
  state: PointerDragState;
}

const DRAG_THRESHOLD_PX = 6;

export function createPointerDrag(cardId: string, x: number, y: number): PointerDragState {
  return {
    active: false,
    cardId,
    placement: 'before',
    startX: x,
    startY: y,
    targetId: cardId,
  };
}

export function updatePointerDrag(
  current: PointerDragState,
  x: number,
  y: number,
  targetId?: string,
  placement?: CardDropPlacement,
): PointerDragUpdate {
  const started = !current.active
    && Math.hypot(x - current.startX, y - current.startY) >= DRAG_THRESHOLD_PX;
  return {
    started,
    state: {
      ...current,
      active: current.active || started,
      placement: placement ?? current.placement,
      targetId: targetId ?? current.targetId,
    },
  };
}
