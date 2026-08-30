import { describe, expect, it } from 'vitest';
import { createPointerDrag, updatePointerDrag } from './pointerGesture';

describe('card pointer gesture', () => {
  it('keeps a stationary pointer as a normal card click', () => {
    const initial = createPointerDrag('card-a', 100, 200);
    const update = updatePointerDrag(initial, 100, 200, 'card-a');

    expect(update.started).toBe(false);
    expect(update.state.active).toBe(false);
  });

  it('starts sorting only after crossing the drag threshold', () => {
    const initial = createPointerDrag('card-a', 100, 200);
    const smallMove = updatePointerDrag(initial, 104, 203, 'card-b');
    const realDrag = updatePointerDrag(smallMove.state, 106, 200, 'card-b');

    expect(smallMove.state.active).toBe(false);
    expect(realDrag.started).toBe(true);
    expect(realDrag.state).toMatchObject({
      active: true,
      cardId: 'card-a',
      targetId: 'card-b',
    });
  });
});
