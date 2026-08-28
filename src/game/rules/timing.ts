import type { TimerChoice } from '../types';

export const DISCONNECT_GRACE_MS = 120_000;

export type TimeoutAction = 'pass' | 'play-smallest-single';
export type DisconnectDecision =
  | 'continue'
  | 'pause-for-player'
  | 'pause-for-host'
  | 'bot-takeover'
  | 'transfer-host';

export function getTurnDurationMs(choice: TimerChoice): number | null {
  if (choice === '不限时') {
    return null;
  }
  return Number.parseInt(choice, 10) * 1_000;
}

export function getTimeoutAction(isLeading: boolean): TimeoutAction {
  return isLeading ? 'play-smallest-single' : 'pass';
}

export function getPublicCardCount(cardCount: number): number | null {
  if (!Number.isInteger(cardCount) || cardCount < 0) {
    throw new Error('手牌数量必须是非负整数');
  }
  return cardCount <= 10 ? cardCount : null;
}

interface DisconnectContext {
  elapsedMs: number;
  isHost: boolean;
  isPlayersTurn: boolean;
  phase: 'lobby' | 'playing';
}

export function getDisconnectDecision(context: DisconnectContext): DisconnectDecision {
  if (context.elapsedMs < 0) {
    throw new Error('掉线时长不能为负数');
  }

  if (context.isHost) {
    if (context.phase === 'playing') {
      return 'pause-for-host';
    }
    return context.elapsedMs >= DISCONNECT_GRACE_MS ? 'transfer-host' : 'continue';
  }

  if (context.phase === 'playing' && context.elapsedMs >= DISCONNECT_GRACE_MS) {
    return 'bot-takeover';
  }

  if (context.phase === 'playing' && context.isPlayersTurn) {
    return 'pause-for-player';
  }

  return 'continue';
}
