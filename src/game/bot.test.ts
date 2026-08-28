import { describe, expect, it } from 'vitest';
import type { CardData, Rank, Suit } from './types';
import { chooseBotAction, enumerateLegalPlays } from './bot';
import { classifyPlay } from './rules/classify';
import { comparePlays } from './rules/compare';

let nextCardId = 4000;

function card(rank: Rank, suit: Suit = 'spades', deck: 1 | 2 = 1): CardData {
  nextCardId += 1;
  return { id: `bot-${nextCardId}`, rank, suit, deck };
}

describe('basic bot', () => {
  it('enumerates every supported family represented in its hand', () => {
    const hand = [
      card('3', 'spades', 1), card('3', 'clubs', 2), card('3', 'diamonds', 1),
      card('4', 'spades', 1), card('4', 'clubs', 2), card('4', 'diamonds', 1),
      card('5', 'spades', 1), card('5', 'clubs', 2),
      card('6', 'spades'), card('7', 'clubs'),
      card('9', 'spades', 1), card('9', 'spades', 2), card('9', 'clubs'), card('9', 'diamonds'),
      card('8', 'hearts'),
    ];
    const kinds = new Set(enumerateLegalPlays(hand, '8').map((play) => play.kind));

    for (const kind of [
      'single',
      'pair',
      'triple',
      'triple-with-pair',
      'straight',
      'consecutive-pairs',
      'steel-plate',
      'bomb',
    ] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
  });

  it('uses the smallest legal single to follow an opponent', () => {
    const lastPlay = classifyPlay([card('6')], '7')[0];
    const action = chooseBotAction({
      botSeat: 0,
      hand: [card('5'), card('8'), card('A')],
      lastPlay,
      lastPlayer: 1,
      level: '7',
    });

    expect(action.type).toBe('play');
    if (action.type === 'play') {
      expect(action.play.primaryRank).toBe('8');
      expect(comparePlays(action.play, lastPlay).canBeat).toBe(true);
    }
  });

  it('passes instead of overtaking a teammate who controls the table', () => {
    const action = chooseBotAction({
      botSeat: 0,
      hand: [card('A'), card('大王', 'joker')],
      lastPlay: classifyPlay([card('3')], '7')[0],
      lastPlayer: 2,
      level: '7',
    });

    expect(action).toEqual({ type: 'pass' });
  });

  it('always returns a rule-engine-approved action when leading', () => {
    const hand = [card('3'), card('3', 'clubs'), card('4'), card('5'), card('6')];
    const action = chooseBotAction({
      botSeat: 1,
      hand,
      lastPlay: null,
      lastPlayer: null,
      level: '7',
    });

    expect(action.type).toBe('play');
    if (action.type === 'play') {
      expect(enumerateLegalPlays(hand, '7')).toContainEqual(action.play);
    }
  });
});
