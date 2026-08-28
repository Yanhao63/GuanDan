import { describe, expect, it } from 'vitest';
import type { CardData, Rank, Suit } from '../types';
import { classifyPlay } from './classify';

let nextCardId = 0;

function card(rank: Rank, suit: Suit = 'spades', deck: 1 | 2 = 1): CardData {
  nextCardId += 1;
  return { id: `test-${nextCardId}`, rank, suit, deck };
}

describe('classifyPlay', () => {
  it('uses the dynamic single-card level order', () => {
    const levelCard = classifyPlay([card('7', 'clubs')], '7')[0];
    const ace = classifyPlay([card('A', 'spades')], '7')[0];
    const smallJoker = classifyPlay([card('小王', 'joker')], '7')[0];

    expect(levelCard.primaryStrength).toBeGreaterThan(ace.primaryStrength);
    expect(smallJoker.primaryStrength).toBeGreaterThan(levelCard.primaryStrength);
  });

  it('treats a single heart level card as its natural level card', () => {
    const interpretations = classifyPlay([card('7', 'hearts')], '7');

    expect(interpretations).toHaveLength(1);
    expect(interpretations[0]).toMatchObject({ kind: 'single', primaryRank: '7', wildcardAssignments: [] });
  });

  it('uses a wildcard to complete a pair and rejects a joker pair substitution', () => {
    const pair = classifyPlay([card('7', 'hearts'), card('A', 'clubs')], '7');
    const invalid = classifyPlay([card('7', 'hearts'), card('大王', 'joker')], '7');

    expect(pair).toHaveLength(1);
    expect(pair[0]).toMatchObject({ kind: 'pair', primaryRank: 'A' });
    expect(pair[0].wildcardAssignments[0].represents.rank).toBe('A');
    expect(invalid).toHaveLength(0);
  });

  it('returns every legal rank when two wildcards form a pair', () => {
    const interpretations = classifyPlay([
      card('7', 'hearts', 1),
      card('7', 'hearts', 2),
    ], '7');

    expect(interpretations).toHaveLength(13);
    expect(interpretations.map((play) => play.primaryRank)).toContain('7');
    expect(interpretations.map((play) => play.primaryRank)).toContain('A');
  });

  it('recognizes A2345 as the smallest straight and 10JQKA as the largest', () => {
    const low = classifyPlay([
      card('A', 'spades'), card('2', 'hearts'), card('3', 'clubs'), card('4', 'diamonds'), card('5', 'spades'),
    ], '7').find((play) => play.kind === 'straight');
    const high = classifyPlay([
      card('10', 'spades'), card('J', 'hearts'), card('Q', 'clubs'), card('K', 'diamonds'), card('A', 'spades'),
    ], '7').find((play) => play.kind === 'straight');
    const invalid = classifyPlay([
      card('J'), card('Q'), card('K'), card('A'), card('2'),
    ], '7');

    expect(low?.primaryStrength).toBe(0);
    expect(high?.primaryStrength).toBe(9);
    expect(invalid.filter((play) => play.kind === 'straight')).toHaveLength(0);
  });

  it('finds all three straight-flush meanings for two wildcards with 10JQ', () => {
    const interpretations = classifyPlay([
      card('7', 'hearts', 1),
      card('7', 'hearts', 2),
      card('10', 'spades'),
      card('J', 'spades'),
      card('Q', 'spades'),
    ], '7').filter((play) => play.kind === 'straight-flush');

    expect(interpretations.map((play) => play.description)).toEqual([
      '同花顺 8-9-10-J-Q',
      '同花顺 9-10-J-Q-K',
      '同花顺 10-J-Q-K-A',
    ]);
  });

  it('forces a same-suit sequence to be a straight flush instead of a normal straight', () => {
    const interpretations = classifyPlay([
      card('3', 'spades'),
      card('4', 'spades'),
      card('5', 'spades'),
      card('6', 'spades'),
      card('7', 'spades'),
    ], '9');

    expect(interpretations.some((play) => play.kind === 'straight-flush')).toBe(true);
    expect(interpretations.some((play) => play.kind === 'straight')).toBe(false);
  });

  it('also forces a wildcard-completed same-suit sequence to be a straight flush', () => {
    const interpretations = classifyPlay([
      card('7', 'hearts'),
      card('10', 'spades'),
      card('J', 'spades'),
      card('Q', 'spades'),
      card('A', 'spades'),
    ], '7');

    expect(interpretations).toHaveLength(1);
    expect(interpretations[0]).toMatchObject({
      kind: 'straight-flush',
      description: '同花顺 10-J-Q-K-A',
    });
    expect(interpretations[0].wildcardAssignments[0].represents).toEqual({ rank: 'K', suit: 'spades' });
  });

  it('recognizes wildcard-extended bombs and four jokers', () => {
    const sixBomb = classifyPlay([
      card('9', 'spades', 1),
      card('9', 'spades', 2),
      card('9', 'clubs', 1),
      card('9', 'diamonds', 1),
      card('7', 'hearts', 1),
      card('7', 'hearts', 2),
    ], '7');
    const fourJokers = classifyPlay([
      card('大王', 'joker', 1),
      card('大王', 'joker', 2),
      card('小王', 'joker', 1),
      card('小王', 'joker', 2),
    ], '7');

    expect(sixBomb).toHaveLength(1);
    expect(sixBomb[0]).toMatchObject({ kind: 'bomb', cardCount: 6, primaryRank: '9' });
    expect(fourJokers).toHaveLength(1);
    expect(fourJokers[0].kind).toBe('four-jokers');
  });

  it('recognizes a triple with a pair only when their ranks differ', () => {
    const valid = classifyPlay([
      card('A', 'spades', 1),
      card('A', 'spades', 2),
      card('A', 'clubs'),
      card('K', 'spades'),
      card('K', 'clubs'),
    ], '7').filter((play) => play.kind === 'triple-with-pair');
    const fiveOfAKind = classifyPlay([
      card('A', 'spades', 1),
      card('A', 'spades', 2),
      card('A', 'clubs'),
      card('A', 'diamonds'),
      card('7', 'hearts'),
    ], '7');

    expect(valid).toHaveLength(1);
    expect(valid[0]).toMatchObject({ primaryRank: 'A', description: '三张 A 带 K 对' });
    expect(fiveOfAKind.filter((play) => play.kind === 'triple-with-pair')).toHaveLength(0);
    expect(fiveOfAKind.some((play) => play.kind === 'bomb')).toBe(true);
  });

  it('returns both legal triple-with-pair meanings when two wildcards make them possible', () => {
    const interpretations = classifyPlay([
      card('A', 'spades', 1),
      card('A', 'clubs', 2),
      card('K', 'diamonds'),
      card('7', 'hearts', 1),
      card('7', 'hearts', 2),
    ], '7').filter((play) => play.kind === 'triple-with-pair');

    expect(interpretations.map((play) => play.description)).toEqual([
      '三张 K 带 A 对',
      '三张 A 带 K 对',
    ]);
  });

  it('recognizes A-2-3 as the smallest and Q-K-A as the largest consecutive pairs', () => {
    const low = classifyPlay([
      card('A', 'spades', 1), card('A', 'clubs', 2),
      card('2', 'spades', 1), card('2', 'clubs', 2),
      card('3', 'spades', 1), card('3', 'clubs', 2),
    ], '7').find((play) => play.kind === 'consecutive-pairs');
    const high = classifyPlay([
      card('Q', 'spades', 1), card('Q', 'clubs', 2),
      card('K', 'spades', 1), card('K', 'clubs', 2),
      card('A', 'spades', 1), card('A', 'clubs', 2),
    ], '7').find((play) => play.kind === 'consecutive-pairs');

    expect(low).toMatchObject({ description: '三连对 A-2-3', primaryStrength: 0 });
    expect(high).toMatchObject({ description: '三连对 Q-K-A', primaryStrength: 11 });
  });

  it('recognizes A-2 as the smallest and K-A as the largest steel plate', () => {
    const low = classifyPlay([
      card('A', 'spades', 1), card('A', 'clubs', 1), card('A', 'diamonds', 2),
      card('2', 'spades', 1), card('2', 'clubs', 1), card('2', 'diamonds', 2),
    ], '7').find((play) => play.kind === 'steel-plate');
    const high = classifyPlay([
      card('K', 'spades', 1), card('K', 'clubs', 1), card('K', 'diamonds', 2),
      card('A', 'spades', 1), card('A', 'clubs', 1), card('A', 'diamonds', 2),
    ], '7').find((play) => play.kind === 'steel-plate');

    expect(low).toMatchObject({ description: '钢板 A-2', primaryStrength: 0 });
    expect(high).toMatchObject({ description: '钢板 K-A', primaryStrength: 12 });
  });

  it('uses wildcards to complete consecutive pairs and steel plates', () => {
    const consecutivePairs = classifyPlay([
      card('3', 'spades', 1), card('3', 'clubs', 2),
      card('4', 'spades', 1), card('4', 'clubs', 2),
      card('5', 'spades', 1), card('7', 'hearts'),
    ], '7').filter((play) => play.kind === 'consecutive-pairs');
    const steelPlate = classifyPlay([
      card('9', 'spades', 1), card('9', 'clubs', 1), card('9', 'diamonds', 2),
      card('10', 'spades', 1), card('10', 'clubs', 1), card('7', 'hearts'),
    ], '7').filter((play) => play.kind === 'steel-plate');

    expect(consecutivePairs.map((play) => play.description)).toContain('三连对 3-4-5');
    expect(steelPlate.map((play) => play.description)).toContain('钢板 9-10');
  });

  it('rejects duplicate physical card ids', () => {
    const duplicate = card('A', 'spades');
    expect(classifyPlay([duplicate, duplicate], '7')).toHaveLength(0);
  });
});
