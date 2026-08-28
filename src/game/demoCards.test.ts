import { describe, expect, it } from 'vitest';
import { demoHand, sortDemoHand } from './demoCards';

describe('sortDemoHand', () => {
  it('places jokers first and the current level directly after them', () => {
    const sorted = sortDemoHand(demoHand, '2');

    expect(sorted.slice(0, 5).map((card) => card.rank)).toEqual([
      '大王',
      '小王',
      '2',
      '2',
      '2',
    ]);
  });

  it('promotes a different level without mutating the original hand', () => {
    const originalOrder = demoHand.map((card) => card.id);
    const sorted = sortDemoHand(demoHand, 'A');

    expect(sorted.slice(0, 4).map((card) => card.rank)).toEqual(['大王', '小王', 'A', 'A']);
    expect(demoHand.map((card) => card.id)).toEqual(originalOrder);
  });
});
