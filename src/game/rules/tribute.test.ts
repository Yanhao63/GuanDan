import { describe, expect, it } from 'vitest';
import type { CardData, Rank, Suit } from '../types';
import {
  getDoubleTributeLeader,
  getHighestTributeChoices,
  isDoubleTributeResisted,
  isSingleTributeResisted,
  isTributableCard,
  isValidReturnCard,
} from './tribute';

let nextCardId = 2000;

function card(rank: Rank, suit: Suit = 'spades', deck: 1 | 2 = 1): CardData {
  nextCardId += 1;
  return { id: `tribute-${nextCardId}`, rank, suit, deck };
}

describe('tribute and return rules', () => {
  it('never allows a heart level card to be paid as tribute', () => {
    expect(isTributableCard(card('7', 'hearts'), '7')).toBe(false);
    expect(isTributableCard(card('7', 'spades'), '7')).toBe(true);
  });

  it('finds every physical card tied for the highest legal tribute', () => {
    const firstBigJoker = card('大王', 'joker', 1);
    const secondBigJoker = card('大王', 'joker', 2);
    const choices = getHighestTributeChoices([
      card('7', 'hearts'),
      card('A'),
      firstBigJoker,
      secondBigJoker,
    ], '7');

    expect(choices).toEqual([firstBigJoker, secondBigJoker]);
  });

  it('only accepts natural ranks from 2 through 10 as return cards', () => {
    expect(isValidReturnCard(card('2'))).toBe(true);
    expect(isValidReturnCard(card('10'))).toBe(true);
    expect(isValidReturnCard(card('J'))).toBe(false);
    expect(isValidReturnCard(card('大王', 'joker'))).toBe(false);
  });

  it('detects single and collective double anti-tribute', () => {
    const bigJokerOne = card('大王', 'joker', 1);
    const bigJokerTwo = card('大王', 'joker', 2);

    expect(isSingleTributeResisted([bigJokerOne, bigJokerTwo])).toBe(true);
    expect(isDoubleTributeResisted([[bigJokerOne], [bigJokerTwo]])).toBe(true);
    expect(isDoubleTributeResisted([[bigJokerOne], [card('小王', 'joker')]])).toBe(false);
  });

  it('lets the higher contributor lead, or the previous head player next seat on a tie', () => {
    expect(getDoubleTributeLeader(
      { card: card('A'), seat: 1 },
      { card: card('K'), seat: 3 },
      0,
      '7',
    )).toBe(1);

    expect(getDoubleTributeLeader(
      { card: card('A', 'spades', 1), seat: 1 },
      { card: card('A', 'clubs', 2), seat: 3 },
      2,
      '7',
    )).toBe(3);
  });
});
