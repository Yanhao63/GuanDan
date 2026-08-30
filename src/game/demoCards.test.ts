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

  it('keeps an ordinary 2 below A when another rank is the level', () => {
    const sorted = sortDemoHand(demoHand, '5');
    const ranks = sorted.map((card) => card.rank);

    expect(ranks.slice(0, 3)).toEqual(['大王', '小王', '5']);
    expect(ranks.indexOf('A')).toBeLessThan(ranks.indexOf('2'));
    expect(ranks.at(-1)).toBe('2');
  });
});
