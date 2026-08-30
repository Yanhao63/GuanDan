import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DirectionalPlay, getTableDirection } from './TableActivity';

describe('table activity directions', () => {
  it('maps every seat to the correct direction from the local player', () => {
    expect(getTableDirection(0, 0)).toBe('self');
    expect(getTableDirection(0, 1)).toBe('right');
    expect(getTableDirection(0, 2)).toBe('top');
    expect(getTableDirection(0, 3)).toBe('left');
  });

  it('keeps the direction mapping correct after rotating the local seat', () => {
    expect(getTableDirection(2, 2)).toBe('self');
    expect(getTableDirection(2, 3)).toBe('right');
    expect(getTableDirection(2, 0)).toBe('top');
    expect(getTableDirection(2, 1)).toBe('left');
  });

  it('renders a directional pass marker for a pass event', () => {
    const markup = renderToStaticMarkup(
      createElement(DirectionalPlay, {
        activeEvent: { cards: [], description: '不要', id: 'pass-1', player: 1 },
        fallbackPlay: null,
        onAnimationComplete: () => undefined,
        selfSeat: 0,
      }),
    );

    expect(markup).toContain('pass-flight played-card-from-right');
    expect(markup).toContain('不要');
  });
});
