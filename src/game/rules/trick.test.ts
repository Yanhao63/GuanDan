import { describe, expect, it } from 'vitest';
import type { CardData, Rank, Suit } from '../types';
import { classifyPlay } from './classify';
import {
  createTrickState,
  nextCounterclockwiseSeat,
  submitPass,
  submitPlay,
  type TrickState,
} from './trick';
import type { PlainRank, PlayInterpretation } from './types';

let nextCardId = 3000;

function card(rank: Rank, suit: Suit = 'spades', deck: 1 | 2 = 1): CardData {
  nextCardId += 1;
  return { id: `trick-${nextCardId}`, rank, suit, deck };
}

function play(rank: Rank, level: PlainRank = '7'): PlayInterpretation {
  const interpretation = classifyPlay([card(rank)], level)[0];
  if (interpretation === undefined) {
    throw new Error('测试牌未能识别');
  }
  return interpretation;
}

describe('counterclockwise trick state', () => {
  it('advances seats counterclockwise and does not allow passing on an empty table', () => {
    expect(nextCounterclockwiseSeat(0)).toBe(1);
    expect(nextCounterclockwiseSeat(3)).toBe(0);
    expect(() => submitPass(createTrickState(0), 0)).toThrow(/首出/);
  });

  it('allows a previous passer to re-enter after the table is raised', () => {
    let state = submitPlay(createTrickState(0), 0, play('3'), 10).state;
    state = submitPass(state, 1).state;
    state = submitPlay(state, 2, play('4'), 10).state;
    state = submitPass(state, 3).state;
    state = submitPass(state, 0).state;

    expect(state.currentSeat).toBe(1);
    expect(state.passedSinceLastPlay).toEqual([3, 0]);
    expect(() => submitPlay(state, 1, play('3'), 9)).toThrow(/不能压过/);
  });

  it('clears a trick after every other active player passes', () => {
    let state = submitPlay(createTrickState(0), 0, play('3'), 10).state;
    state = submitPass(state, 1).state;
    state = submitPass(state, 2).state;
    const transition = submitPass(state, 3);

    expect(transition.event).toBe('trick-reset');
    expect(transition.state).toMatchObject({
      currentSeat: 0,
      lastPlay: null,
      lastPlayer: null,
      passedSinceLastPlay: [],
    });
  });

  it('gives the next lead to the partner when the last player went out', () => {
    let state = submitPlay(createTrickState(0), 0, play('3'), 0).state;
    state = submitPass(state, 1).state;
    state = submitPass(state, 2).state;
    const transition = submitPass(state, 3);

    expect(transition.event).toBe('trick-reset');
    expect(transition.state.currentSeat).toBe(2);
    expect(transition.state.finishOrder).toEqual([0]);
  });

  it('ends immediately when head and second place are teammates', () => {
    const stateWithHead: TrickState = {
      ...createTrickState(2),
      finishOrder: [0],
    };
    const transition = submitPlay(stateWithHead, 2, play('3'), 0);

    expect(transition.event).toBe('deal-complete');
    expect(transition.state).toMatchObject({ currentSeat: null, finishOrder: [0, 2], status: 'complete' });
  });

  it('adds the unplayed last seat and completes the deal after third place', () => {
    const stateWithTwoFinishers: TrickState = {
      ...createTrickState(2),
      finishOrder: [0, 1],
    };
    const transition = submitPlay(stateWithTwoFinishers, 2, play('3'), 0);

    expect(transition.event).toBe('deal-complete');
    expect(transition.state.finishOrder).toEqual([0, 1, 2, 3]);
  });
});
