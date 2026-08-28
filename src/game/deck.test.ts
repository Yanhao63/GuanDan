import { describe, expect, it } from 'vitest';
import { createDeck, createShuffledDeal, dealFourHands, shuffleDeck } from './deck';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

describe('two-deck creation and dealing', () => {
  it('creates 108 unique physical cards with four jokers and two heart cards per rank', () => {
    const deck = createDeck();

    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((card) => card.id)).size).toBe(108);
    expect(deck.filter((card) => card.suit === 'joker')).toHaveLength(4);
    expect(deck.filter((card) => card.rank === '7' && card.suit === 'hearts')).toHaveLength(2);
  });

  it('shuffles without changing the source deck or losing cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, seededRandom(2026));

    expect(shuffled).not.toEqual(deck);
    expect(deck[0].id).toBe('1-spades-2');
    expect(new Set(shuffled.map((card) => card.id))).toEqual(new Set(deck.map((card) => card.id)));
  });

  it('deals exactly 27 unique cards to each of four seats', () => {
    const hands = createShuffledDeal(seededRandom(42));
    const dealtCards = Object.values(hands).flat();

    expect(Object.values(hands).map((hand) => hand.length)).toEqual([27, 27, 27, 27]);
    expect(new Set(dealtCards.map((card) => card.id)).size).toBe(108);
  });

  it('rejects an incomplete or duplicate deck', () => {
    const deck = createDeck();
    expect(() => dealFourHands(deck.slice(0, 107))).toThrow(/108/);
    expect(() => dealFourHands([...deck.slice(0, 107), deck[0]])).toThrow(/不重复/);
  });
});
