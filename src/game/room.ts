import { createShuffledDeal, type RandomSource } from './deck';
import { chooseBotAction } from './bot';
import { classifyPlay } from './rules/classify';
import { type MatchProgress, type Seat } from './rules/match';
import { createTrickState, submitPass, submitPlay, type TrickState } from './rules/trick';
import { getPublicCardCount } from './rules/timing';
import type { PlainRank, PlayInterpretation } from './rules/types';
import type { CardData, PlayerKind, TimerChoice } from './types';

export type RoomPhase = 'lobby' | 'playing' | 'complete';

export interface RoomMemberState {
  connected: boolean;
  hand: CardData[];
  id: string;
  isHost: boolean;
  kind: PlayerKind;
  nickname: string;
  reconnectCode: string;
  seat: Seat;
}

export interface RoomSnapshot {
  level: PlainRank;
  members: Array<RoomMemberState | null>;
  phase: RoomPhase;
  progress: MatchProgress;
  roomCode: string;
  timer: TimerChoice;
  trick: TrickState | null;
}

export interface JoinReceipt {
  reconnectCode: string;
  roomCode: string;
  seat: Seat;
  sessionId: string;
}

export interface RoomPlayerView {
  cardCount: number | null;
  connected: boolean;
  isHost: boolean;
  kind: PlayerKind;
  nickname: string;
  seat: Seat;
}

export interface RoomView {
  currentSeat: Seat | null;
  hand: CardData[];
  lastPlay: null | {
    cards: CardData[];
    description: string;
    player: Seat;
  };
  level: PlainRank;
  phase: RoomPhase;
  players: RoomPlayerView[];
  roomCode: string;
  selfSeat: Seat;
  timer: TimerChoice;
}

export type TokenSource = () => string;

const INITIAL_PROGRESS: MatchProgress = {
  'team-a': { level: '2', aFailures: 0 },
  'team-b': { level: '2', aFailures: 0 },
};

function normalizeNickname(nickname: string): string {
  return nickname.trim();
}

function validateRandomSample(sample: number): number {
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error('随机数源必须返回大于等于 0 且小于 1 的数');
  }
  return sample;
}

function playMatchesDescription(play: PlayInterpretation, description: string | undefined): boolean {
  return description === undefined || play.description === description;
}

export class RoomEngine {
  private level: PlainRank = '2';
  private members: Array<RoomMemberState | null> = [null, null, null, null];
  private phase: RoomPhase = 'lobby';
  private progress: MatchProgress = structuredClone(INITIAL_PROGRESS);
  private timer: TimerChoice = '不限时';
  private trick: TrickState | null = null;

  constructor(
    private readonly roomCode: string,
    private readonly random: RandomSource,
    private readonly createToken: TokenSource,
  ) {}

  static restore(
    snapshot: RoomSnapshot,
    random: RandomSource,
    createToken: TokenSource,
  ): RoomEngine {
    const room = new RoomEngine(snapshot.roomCode, random, createToken);
    room.level = snapshot.level;
    room.members = structuredClone(snapshot.members);
    room.phase = snapshot.phase;
    room.progress = structuredClone(snapshot.progress);
    room.timer = snapshot.timer;
    room.trick = structuredClone(snapshot.trick);
    return room;
  }

  private getMember(sessionId: string): RoomMemberState {
    const member = this.members.find((candidate) => candidate?.id === sessionId);
    if (member === null || member === undefined) {
      throw new Error('玩家不在本房间');
    }
    return member;
  }

  private requireHost(sessionId: string): RoomMemberState {
    const member = this.getMember(sessionId);
    if (!member.isHost) {
      throw new Error('只有房主可以执行此操作');
    }
    return member;
  }

  private requireLobby(): void {
    if (this.phase !== 'lobby') {
      throw new Error('该操作只能在牌局开始前执行');
    }
  }

  joinHuman(nickname: string): JoinReceipt {
    this.requireLobby();
    const normalized = normalizeNickname(nickname);
    if (normalized.length === 0) {
      throw new Error('昵称不能为空');
    }

    const sameNickname = this.members.find((member) => member?.nickname === normalized);
    if (sameNickname !== null && sameNickname !== undefined) {
      if (sameNickname.connected) {
        throw new Error('该昵称已在房间中使用');
      }
      sameNickname.connected = true;
      return this.makeReceipt(sameNickname);
    }

    const seat = this.members.findIndex((member) => member === null);
    if (seat < 0) {
      throw new Error('房间已经坐满');
    }

    const member: RoomMemberState = {
      connected: true,
      hand: [],
      id: this.createToken(),
      isHost: this.members.every((candidate) => candidate === null),
      kind: 'human',
      nickname: normalized,
      reconnectCode: this.createToken(),
      seat: seat as Seat,
    };
    this.members[seat] = member;
    return this.makeReceipt(member);
  }

  reconnect(identifier: string): JoinReceipt {
    const member = this.members.find((candidate) =>
      candidate?.kind === 'human'
      && (candidate.nickname === normalizeNickname(identifier) || candidate.reconnectCode === identifier),
    );
    if (member === null || member === undefined) {
      throw new Error('没有找到可重连的座位');
    }
    if (member.connected) {
      throw new Error('该玩家当前仍在线');
    }
    member.connected = true;
    return this.makeReceipt(member);
  }

  disconnect(sessionId: string): void {
    const member = this.getMember(sessionId);
    if (member.kind === 'human') {
      member.connected = false;
    }
  }

  addBot(hostSessionId: string, seat: Seat): void {
    this.requireLobby();
    this.requireHost(hostSessionId);
    if (this.members[seat] !== null) {
      throw new Error('该座位已经有人');
    }
    this.members[seat] = {
      connected: true,
      hand: [],
      id: `bot-${seat}-${this.createToken()}`,
      isHost: false,
      kind: 'bot',
      nickname: `机器人 ${seat + 1}`,
      reconnectCode: '',
      seat,
    };
  }

  removeBot(hostSessionId: string, seat: Seat): void {
    this.requireLobby();
    this.requireHost(hostSessionId);
    if (this.members[seat]?.kind !== 'bot') {
      throw new Error('该座位不是机器人');
    }
    this.members[seat] = null;
  }

  setTimer(hostSessionId: string, timer: TimerChoice): void {
    this.requireLobby();
    this.requireHost(hostSessionId);
    this.timer = timer;
  }

  start(hostSessionId: string): void {
    this.requireLobby();
    this.requireHost(hostSessionId);
    if (this.members.some((member) => member === null)) {
      throw new Error('需要四位玩家全部入座');
    }

    const hands = createShuffledDeal(this.random);
    this.members.forEach((member, seat) => {
      if (member !== null) {
        member.hand = hands[seat as Seat];
      }
    });
    const leader = Math.floor(validateRandomSample(this.random()) * 4) as Seat;
    this.trick = createTrickState(leader);
    this.phase = 'playing';
  }

  play(sessionId: string, cardIds: string[], description?: string): void {
    if (this.phase !== 'playing' || this.trick === null) {
      throw new Error('牌局当前不能出牌');
    }
    const member = this.getMember(sessionId);
    if (new Set(cardIds).size !== cardIds.length) {
      throw new Error('不能重复提交同一张牌');
    }
    const selectedCards = cardIds.map((cardId) => member.hand.find((card) => card.id === cardId));
    if (selectedCards.some((card) => card === undefined)) {
      throw new Error('所选牌不完全属于该玩家');
    }

    const cards = selectedCards as CardData[];
    const interpretations = classifyPlay(cards, this.level);
    const play = interpretations.find((candidate) => playMatchesDescription(candidate, description));
    if (play === undefined) {
      throw new Error('所选手牌或牌型解释不合法');
    }
    if (description === undefined && interpretations.length > 1) {
      throw new Error('这手牌存在多种解释，必须明确选择');
    }

    const transition = submitPlay(
      this.trick,
      member.seat,
      play,
      member.hand.length - cards.length,
    );
    member.hand = member.hand.filter((card) => !cardIds.includes(card.id));
    this.trick = transition.state;
    if (transition.event === 'deal-complete') {
      this.phase = 'complete';
    }
  }

  pass(sessionId: string): void {
    if (this.phase !== 'playing' || this.trick === null) {
      throw new Error('牌局当前不能选择不要');
    }
    const member = this.getMember(sessionId);
    this.trick = submitPass(this.trick, member.seat).state;
  }

  runCurrentBotTurn(): boolean {
    if (this.phase !== 'playing' || this.trick?.currentSeat === null || this.trick === null) {
      return false;
    }
    const member = this.members[this.trick.currentSeat];
    if (member === null || member.kind !== 'bot') {
      return false;
    }

    const action = chooseBotAction({
      botSeat: member.seat,
      hand: member.hand,
      lastPlay: this.trick.lastPlay,
      lastPlayer: this.trick.lastPlayer,
      level: this.level,
    });
    if (action.type === 'pass') {
      this.pass(member.id);
    } else {
      this.play(
        member.id,
        action.play.cards.map((card) => card.id),
        action.play.description,
      );
    }
    return true;
  }

  getView(sessionId: string): RoomView {
    const self = this.getMember(sessionId);
    return {
      currentSeat: this.trick?.currentSeat ?? null,
      hand: [...self.hand],
      lastPlay: this.trick?.lastPlay === null || this.trick?.lastPlayer === null || this.trick === null
        ? null
        : {
            cards: [...this.trick.lastPlay.cards],
            description: this.trick.lastPlay.description,
            player: this.trick.lastPlayer,
          },
      level: this.level,
      phase: this.phase,
      players: this.members.flatMap((member) => member === null ? [] : [{
        cardCount: member.id === sessionId ? member.hand.length : getPublicCardCount(member.hand.length),
        connected: member.connected,
        isHost: member.isHost,
        kind: member.kind,
        nickname: member.nickname,
        seat: member.seat,
      }]),
      roomCode: this.roomCode,
      selfSeat: self.seat,
      timer: this.timer,
    };
  }

  getProgress(): MatchProgress {
    return structuredClone(this.progress);
  }

  toSnapshot(): RoomSnapshot {
    return {
      level: this.level,
      members: structuredClone(this.members),
      phase: this.phase,
      progress: structuredClone(this.progress),
      roomCode: this.roomCode,
      timer: this.timer,
      trick: structuredClone(this.trick),
    };
  }

  getSessionIdAtSeat(seat: Seat): string {
    const member = this.members[seat];
    if (member === null) {
      throw new Error('该座位为空');
    }
    return member.id;
  }

  private makeReceipt(member: RoomMemberState): JoinReceipt {
    return {
      reconnectCode: member.reconnectCode,
      roomCode: this.roomCode,
      seat: member.seat,
      sessionId: member.id,
    };
  }
}
