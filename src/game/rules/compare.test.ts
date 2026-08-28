import { describe, expect, it } from 'vitest';
import type { CardData, Rank, Suit } from '../types';
import { classifyPlay } from './classify';
import { comparePlays } from './compare';

let nextCardId = 1000;

function card(rank: Rank, suit: Suit = 'spades', deck: 1 | 2 = 1): CardData {
  nextCardId += 1;
  return { id: `compare-${nextCardId}`, rank, suit, deck };
}

function only(cards: CardData[], level: Exclude<Rank, '小王' | '大王'>, kind: string) {
  const play = classifyPlay(cards, level).find((candidate) => candidate.kind === kind);
  if (play === undefined) {
    throw new Error(`未识别出 ${kind}`);
  }
  return play;
}

describe('comparePlays', () => {
  it('requires matching ordinary types and a strictly higher rank', () => {
    const pairOfAces = only([card('A'), card('A', 'clubs')], '7', 'pair');
    const pairOfKings = only([card('K'), card('K', 'clubs')], '7', 'pair');
    const tripleOfAces = only([card('A'), card('A', 'clubs'), card('A', 'diamonds')], '7', 'triple');

    expect(comparePlays(pairOfAces, pairOfKings)).toEqual({ canBeat: true, reason: 'higher' });
    expect(comparePlays(pairOfAces, pairOfAces)).toEqual({ canBeat: false, reason: 'equal' });
    expect(comparePlays(tripleOfAces, pairOfKings).reason).toBe('different-kind');
  });

  it('uses the confirmed bomb hierarchy', () => {
    const fiveBomb = only([
      card('9', 'spades', 1), card('9', 'spades', 2), card('9', 'clubs'), card('9', 'diamonds'), card('7', 'hearts'),
    ], '7', 'bomb');
    const sixBomb = only([
      card('8', 'spades', 1), card('8', 'spades', 2), card('8', 'clubs'), card('8', 'diamonds'), card('7', 'hearts', 1), card('7', 'hearts', 2),
    ], '7', 'bomb');
    const straightFlush = only([
      card('3', 'spades'), card('4', 'spades'), card('5', 'spades'), card('6', 'spades'), card('7', 'spades'),
    ], '7', 'straight-flush');
    const fourJokers = only([
      card('大王', 'joker', 1), card('大王', 'joker', 2), card('小王', 'joker', 1), card('小王', 'joker', 2),
    ], '7', 'four-jokers');

    expect(comparePlays(straightFlush, fiveBomb).canBeat).toBe(true);
    expect(comparePlays(sixBomb, straightFlush).canBeat).toBe(true);
    expect(comparePlays(fourJokers, sixBomb).canBeat).toBe(true);
  });

  it('does not allow an equal-rank bomb to beat itself', () => {
    const firstBomb = only([
      card('K', 'spades', 1), card('K', 'spades', 2), card('K', 'clubs'), card('K', 'diamonds'),
    ], '7', 'bomb');
    const secondBomb = only([
      card('K', 'hearts', 1), card('K', 'hearts', 2), card('K', 'clubs', 2), card('K', 'diamonds', 2),
    ], '7', 'bomb');

    expect(comparePlays(secondBomb, firstBomb)).toEqual({ canBeat: false, reason: 'equal' });
  });
});
