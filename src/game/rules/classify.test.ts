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
      card('A'), card('2'), card('3'), card('4'), card('5'),
    ], '7').find((play) => play.kind === 'straight');
    const high = classifyPlay([
      card('10'), card('J'), card('Q'), card('K'), card('A'),
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

  it('rejects duplicate physical card ids', () => {
    const duplicate = card('A', 'spades');
    expect(classifyPlay([duplicate, duplicate], '7')).toHaveLength(0);
  });
});
