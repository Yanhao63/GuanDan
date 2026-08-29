import { describe, expect, it } from 'vitest';
import type { CardData } from './types';
import { applyHandOrder, moveCardBefore } from './handOrder';

const cards = ['a', 'b', 'c'].map((id, index) => ({
  deck: 1,
  id,
  rank: String(index + 2) as CardData['rank'],
  suit: 'spades',
}) satisfies CardData);

describe('local hand ordering', () => {
  it('keeps a custom order and appends newly received cards', () => {
    expect(applyHandOrder(cards, ['c', 'a']).map((card) => card.id)).toEqual(['c', 'a', 'b']);
  });

  it('drops cards no longer in hand without disturbing the remaining order', () => {
    expect(applyHandOrder(cards.slice(1), ['c', 'a', 'b']).map((card) => card.id)).toEqual(['c', 'b']);
  });

  it('moves a dragged card immediately before its target', () => {
    expect(moveCardBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(moveCardBefore(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c']);
  });
});
