import { describe, expect, it } from 'vitest';
import { RoomEngine } from './room';
import { DISCONNECT_GRACE_MS } from './rules/timing';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function tokenSource(): () => string {
  let token = 0;
  return () => `token-${token += 1}`;
}

function fullHumanRoom(): {
  receipts: ReturnType<RoomEngine['joinHuman']>[];
  room: RoomEngine;
} {
  const room = new RoomEngine('123456', seededRandom(42), tokenSource());
  const receipts = ['甲', '乙', '丙', '丁'].map((name) => room.joinHuman(name));
  return { receipts, room };
}

describe('authoritative room engine', () => {
  it('forbids duplicate nicknames and a fifth player', () => {
    const room = new RoomEngine('123456', seededRandom(1), tokenSource());
    room.joinHuman('甲');
    expect(() => room.joinHuman(' 甲 ')).toThrow(/昵称/);
    room.joinHuman('乙');
    room.joinHuman('丙');
    room.joinHuman('丁');
    expect(() => room.joinHuman('戊')).toThrow(/坐满/);
  });

  it('enforces host-only bot, timer and start controls', () => {
    const room = new RoomEngine('123456', seededRandom(2), tokenSource());
    const host = room.joinHuman('房主');
    const guest = room.joinHuman('朋友');

    expect(() => room.addBot(guest.sessionId, 2)).toThrow(/房主/);
    room.addBot(host.sessionId, 2);
    room.addBot(host.sessionId, 3);
    room.setTimer(host.sessionId, '60秒');
    room.start(host.sessionId);

    expect(room.getView(host.sessionId)).toMatchObject({ phase: 'playing', timer: '60秒' });
  });

  it('deals 27 cards while hiding opponents exact counts above ten', () => {
    const { receipts, room } = fullHumanRoom();
    room.start(receipts[0].sessionId);

    for (const receipt of receipts) {
      const view = room.getView(receipt.sessionId);
      expect(view.hand).toHaveLength(27);
      expect(view.players.find((player) => player.seat === receipt.seat)?.cardCount).toBe(27);
      expect(view.players.filter((player) => player.seat !== receipt.seat).every((player) => player.cardCount === null)).toBe(true);
    }
  });

  it('accepts only the current player own legal cards and publishes the played cards', () => {
    const { receipts, room } = fullHumanRoom();
    room.start(receipts[0].sessionId);
    const firstView = room.getView(receipts[0].sessionId);
    const leaderSeat = firstView.currentSeat;
    if (leaderSeat === null) {
      throw new Error('没有首出玩家');
    }
    const leader = receipts.find((receipt) => receipt.seat === leaderSeat);
    const other = receipts.find((receipt) => receipt.seat !== leaderSeat);
    if (leader === undefined || other === undefined) {
      throw new Error('测试座位缺失');
    }
    const selectedCard = room.getView(leader.sessionId).hand[0];

    expect(() => room.play(other.sessionId, [selectedCard.id])).toThrow(/不完全属于/);
    room.play(leader.sessionId, [selectedCard.id]);

    const publicView = room.getView(other.sessionId);
    expect(publicView.lastPlay?.cards).toEqual([selectedCard]);
    expect(room.getView(leader.sessionId).hand).toHaveLength(26);
  });

  it('restores a disconnected human by nickname or reconnect code', () => {
    const room = new RoomEngine('123456', seededRandom(3), tokenSource());
    const host = room.joinHuman('归来');
    room.disconnect(host.sessionId);

    const byNickname = room.reconnect('归来');
    expect(byNickname.sessionId).toBe(host.sessionId);
    room.disconnect(host.sessionId);
    const byCode = room.reconnect(host.reconnectCode);
    expect(byCode.seat).toBe(host.seat);
  });

  it('ignores a stale socket close after a newer reconnect takes over the same seat', () => {
    const room = new RoomEngine('123456', seededRandom(4), tokenSource());
    const host = room.joinHuman('刷新回来');
    room.attachConnection(host.sessionId, 'connection-old');

    room.reconnect(host.reconnectCode);
    room.attachConnection(host.sessionId, 'connection-new');
    room.disconnect(host.sessionId, 1_000, 'connection-old');

    expect(room.getView(host.sessionId).players[0].connected).toBe(true);

    room.disconnect(host.sessionId, 2_000, 'connection-new');
    expect(room.getView(host.sessionId).players[0].connected).toBe(false);
  });

  it('restores the authoritative room from a persisted snapshot', () => {
    const { receipts, room } = fullHumanRoom();
    room.setTimer(receipts[0].sessionId, '90秒');
    room.start(receipts[0].sessionId);
    const before = room.getView(receipts[0].sessionId);

    const restored = RoomEngine.restore(room.toSnapshot(), seededRandom(9), tokenSource());
    const after = restored.getView(receipts[0].sessionId);

    expect(after).toEqual(before);
  });

  it('automatically advances consecutive bot turns until a human must act', () => {
    const room = new RoomEngine('123456', seededRandom(12), tokenSource());
    const host = room.joinHuman('房主');
    room.addBot(host.sessionId, 1);
    room.addBot(host.sessionId, 2);
    room.addBot(host.sessionId, 3);
    room.start(host.sessionId);

    let botTurns = 0;
    while (room.runCurrentBotTurn()) {
      botTurns += 1;
      if (botTurns > 100) {
        throw new Error('机器人回合未能停止');
      }
    }

    const view = room.getView(host.sessionId);
    expect(view.phase === 'complete' || view.currentSeat === host.seat).toBe(true);
  });

  it('transfers a disconnected lobby host after 120 seconds', () => {
    const { receipts, room } = fullHumanRoom();
    room.disconnect(receipts[0].sessionId, 1_000);

    expect(room.getNextDisconnectDeadline()).toBe(1_000 + DISCONNECT_GRACE_MS);
    expect(room.applyDisconnectTimeouts(1_000 + DISCONNECT_GRACE_MS - 1)).toEqual([]);
    expect(room.applyDisconnectTimeouts(1_000 + DISCONNECT_GRACE_MS)).toEqual([
      { from: 0, to: 1, type: 'host-transfer' },
    ]);
    expect(room.getView(receipts[1].sessionId).players.find((player) => player.seat === 1)?.isHost).toBe(true);
  });

  it('pauses on an ordinary player turn, then lets a bot take over after 120 seconds', () => {
    const room = new RoomEngine('123456', () => 0.3, tokenSource());
    const receipts = ['甲', '乙', '丙', '丁'].map((name) => room.joinHuman(name));
    room.start(receipts[0].sessionId);
    expect(room.getView(receipts[0].sessionId).currentSeat).toBe(1);

    room.disconnect(receipts[1].sessionId, 5_000);
    expect(room.getView(receipts[0].sessionId).pause).toEqual({ kind: 'player', seat: 1 });
    expect(room.runCurrentBotTurn()).toBe(false);

    expect(room.applyDisconnectTimeouts(5_000 + DISCONNECT_GRACE_MS)).toEqual([
      { seat: 1, type: 'bot-takeover' },
    ]);
    expect(room.getView(receipts[0].sessionId).pause).toBeNull();
    expect(room.getView(receipts[0].sessionId).players.find((player) => player.seat === 1)?.controlledByBot).toBe(true);
    expect(room.runCurrentBotTurn()).toBe(true);

    room.reconnect(receipts[1].reconnectCode);
    expect(room.getView(receipts[1].sessionId).players.find((player) => player.seat === 1)).toMatchObject({
      connected: true,
      controlledByBot: false,
    });
  });

  it('keeps an active game paused indefinitely while the original host is disconnected', () => {
    const room = new RoomEngine('123456', () => 0.3, tokenSource());
    const receipts = ['甲', '乙', '丙', '丁'].map((name) => room.joinHuman(name));
    room.start(receipts[0].sessionId);
    room.disconnect(receipts[0].sessionId, 8_000);

    expect(room.getView(receipts[1].sessionId).pause).toEqual({ kind: 'host', seat: 0 });
    expect(room.getNextDisconnectDeadline()).toBeNull();
    expect(room.applyDisconnectTimeouts(8_000 + DISCONNECT_GRACE_MS * 2)).toEqual([]);
    expect(() => room.play(
      receipts[1].sessionId,
      [room.getView(receipts[1].sessionId).hand[0].id],
    )).toThrow(/等待掉线玩家/);
  });
});
