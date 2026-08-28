import { comparePlays } from './compare';
import { getTeamForSeat, type Seat } from './match';
import type { PlayInterpretation } from './types';

export interface TrickState {
  currentSeat: Seat | null;
  finishOrder: Seat[];
  lastPlay: PlayInterpretation | null;
  lastPlayer: Seat | null;
  passedSinceLastPlay: Seat[];
  status: 'playing' | 'complete';
}

export type TurnEvent = 'played' | 'passed' | 'trick-reset' | 'deal-complete';

export interface TurnTransition {
  event: TurnEvent;
  state: TrickState;
}

export function nextCounterclockwiseSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

function nextActiveSeat(after: Seat, finishOrder: Seat[]): Seat {
  let candidate = nextCounterclockwiseSeat(after);
  while (finishOrder.includes(candidate)) {
    candidate = nextCounterclockwiseSeat(candidate);
  }
  return candidate;
}

function validateTurn(state: TrickState, seat: Seat): void {
  if (state.status === 'complete' || state.currentSeat === null) {
    throw new Error('本副牌已经结束');
  }
  if (state.currentSeat !== seat) {
    throw new Error('还没有轮到该玩家');
  }
  if (state.finishOrder.includes(seat)) {
    throw new Error('已经出完牌的玩家不能继续操作');
  }
}

function completeIfNeeded(state: TrickState): TrickState | null {
  const [first, second] = state.finishOrder;
  if (
    state.finishOrder.length === 2
    && getTeamForSeat(first) === getTeamForSeat(second)
  ) {
    return { ...state, currentSeat: null, status: 'complete' };
  }

  if (state.finishOrder.length === 3) {
    const lastSeat = ([0, 1, 2, 3] as Seat[]).find(
      (seat) => !state.finishOrder.includes(seat),
    );
    if (lastSeat === undefined) {
      throw new Error('无法确定末游');
    }
    return {
      ...state,
      currentSeat: null,
      finishOrder: [...state.finishOrder, lastSeat],
      status: 'complete',
    };
  }

  return null;
}

export function createTrickState(leader: Seat): TrickState {
  return {
    currentSeat: leader,
    finishOrder: [],
    lastPlay: null,
    lastPlayer: null,
    passedSinceLastPlay: [],
    status: 'playing',
  };
}

export function submitPlay(
  state: TrickState,
  seat: Seat,
  play: PlayInterpretation,
  cardsRemaining: number,
): TurnTransition {
  validateTurn(state, seat);
  if (!Number.isInteger(cardsRemaining) || cardsRemaining < 0) {
    throw new Error('剩余手牌数必须是非负整数');
  }
  if (state.lastPlay !== null && !comparePlays(play, state.lastPlay).canBeat) {
    throw new Error('所选牌型不能压过当前牌面');
  }

  const finishOrder = cardsRemaining === 0
    ? [...state.finishOrder, seat]
    : state.finishOrder;
  const playedState: TrickState = {
    ...state,
    currentSeat: nextActiveSeat(seat, finishOrder),
    finishOrder,
    lastPlay: play,
    lastPlayer: seat,
    passedSinceLastPlay: [],
  };
  const completedState = completeIfNeeded(playedState);

  return completedState === null
    ? { event: 'played', state: playedState }
    : { event: 'deal-complete', state: completedState };
}

export function submitPass(state: TrickState, seat: Seat): TurnTransition {
  validateTurn(state, seat);
  if (state.lastPlay === null || state.lastPlayer === null) {
    throw new Error('首出玩家不能选择不要');
  }

  const passedSinceLastPlay = [...state.passedSinceLastPlay, seat];
  const activeSeats = 4 - state.finishOrder.length;
  const lastPlayerIsActive = !state.finishOrder.includes(state.lastPlayer);
  const passesNeeded = activeSeats - (lastPlayerIsActive ? 1 : 0);

  if (passedSinceLastPlay.length < passesNeeded) {
    return {
      event: 'passed',
      state: {
        ...state,
        currentSeat: nextActiveSeat(seat, state.finishOrder),
        passedSinceLastPlay,
      },
    };
  }

  const leader = lastPlayerIsActive
    ? state.lastPlayer
    : ((state.lastPlayer + 2) % 4) as Seat;
  if (state.finishOrder.includes(leader)) {
    throw new Error('应接风的对家已经出完时，本副牌应已进入结算');
  }

  return {
    event: 'trick-reset',
    state: {
      ...state,
      currentSeat: leader,
      lastPlay: null,
      lastPlayer: null,
      passedSinceLastPlay: [],
    },
  };
}
