import { describe, expect, it } from 'vitest';
import {
  DISCONNECT_GRACE_MS,
  getDisconnectDecision,
  getPublicCardCount,
  getTimeoutAction,
  getTurnDurationMs,
} from './timing';

describe('turn timing and public information', () => {
  it('maps all four timer choices and timeout actions', () => {
    expect(getTurnDurationMs('不限时')).toBeNull();
    expect(getTurnDurationMs('30秒')).toBe(30_000);
    expect(getTurnDurationMs('60秒')).toBe(60_000);
    expect(getTurnDurationMs('90秒')).toBe(90_000);
    expect(getTimeoutAction(true)).toBe('play-smallest-single');
    expect(getTimeoutAction(false)).toBe('pass');
  });

  it('only exposes an exact hand count at ten cards or fewer', () => {
    expect(getPublicCardCount(11)).toBeNull();
    expect(getPublicCardCount(10)).toBe(10);
    expect(getPublicCardCount(0)).toBe(0);
  });
});

describe('disconnect decisions', () => {
  it('keeps an active game paused for a disconnected host without transferring ownership', () => {
    expect(getDisconnectDecision({
      elapsedMs: DISCONNECT_GRACE_MS * 2,
      isHost: true,
      isPlayersTurn: false,
      phase: 'playing',
    })).toBe('pause-for-host');
  });

  it('transfers a lobby host after 120 seconds', () => {
    expect(getDisconnectDecision({
      elapsedMs: DISCONNECT_GRACE_MS,
      isHost: true,
      isPlayersTurn: false,
      phase: 'lobby',
    })).toBe('transfer-host');
  });

  it('continues until an ordinary disconnected player turn, then pauses or starts a bot', () => {
    expect(getDisconnectDecision({
      elapsedMs: 30_000,
      isHost: false,
      isPlayersTurn: false,
      phase: 'playing',
    })).toBe('continue');
    expect(getDisconnectDecision({
      elapsedMs: 30_000,
      isHost: false,
      isPlayersTurn: true,
      phase: 'playing',
    })).toBe('pause-for-player');
    expect(getDisconnectDecision({
      elapsedMs: DISCONNECT_GRACE_MS,
      isHost: false,
      isPlayersTurn: true,
      phase: 'playing',
    })).toBe('bot-takeover');
  });
});
