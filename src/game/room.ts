import { createShuffledDeal, type RandomSource } from './deck';
import { chooseBotAction } from './bot';
import { classifyPlay } from './rules/classify';
import {
  settleDeal,
  type DealSettlement,
  type MatchProgress,
  type Seat,
} from './rules/match';
import { getRankStrength } from './rules/ranks';
import { createTrickState, submitPass, submitPlay, type TrickState } from './rules/trick';
import {
  DISCONNECT_GRACE_MS,
  getPublicCardCount,
  getTurnDurationMs,
} from './rules/timing';
import {
  beginTributeRound,
  chooseDoubleTribute,
  getHighestTributeChoices,
  getReturnCardChoices,
  submitReturnCard,
  submitTribute,
  type HandsBySeat,
  type TributeRoundState,
  type TributeTransition,
} from './rules/tribute';
import type { PlainRank, PlayInterpretation } from './rules/types';
import type { CardData, PlayerKind, TimerChoice } from './types';

export type RoomPhase = 'lobby' | 'tribute' | 'playing' | 'complete';

export interface RoomMemberState {
  connected: boolean;
  connectionId: string | null;
  controlledByBot: boolean;
  disconnectedAt: number | null;
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
  settlement?: DealSettlement | null;
  turnDeadline?: number | null;
  tribute?: TributeRoundState | null;
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
  controlledByBot: boolean;
  isHost: boolean;
  kind: PlayerKind;
  nickname: string;
  seat: Seat;
}

export interface RoomPlayEvent {
  cards: CardData[];
  description: string;
  player: Seat;
}

export interface RoomView {
  currentSeat: Seat | null;
  finishOrder: Seat[];
  hand: CardData[];
  lastPlay: null | {
    cards: CardData[];
    description: string;
    player: Seat;
  };
  level: PlainRank;
  phase: RoomPhase;
  pause: null | {
    kind: 'host' | 'player';
    seat: Seat;
  };
  players: RoomPlayerView[];
  progress: MatchProgress;
  roomCode: string;
  selfSeat: Seat;
  settlement: DealSettlement | null;
  timer: TimerChoice;
  turnDeadline: number | null;
  tribute: TributeView | null;
}

export type TributeAction = 'pay-tribute' | 'choose-double-tribute' | 'return-tribute' | 'waiting';

export interface TributeView {
  action: TributeAction;
  choices: CardData[];
  message: string;
  mode: 'single' | 'double';
}

export type TokenSource = () => string;

export type DisconnectEvent =
  | { seat: Seat; type: 'bot-takeover' }
  | { from: Seat; to: Seat; type: 'host-transfer' };

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
  private settlement: DealSettlement | null = null;
  private timer: TimerChoice = '不限时';
  private trick: TrickState | null = null;
  private turnDeadline: number | null = null;
  private tribute: TributeRoundState | null = null;

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
    room.members = structuredClone(snapshot.members).map((member) => member === null ? null : ({
      ...member,
      connectionId: member.connectionId ?? null,
      controlledByBot: member.controlledByBot ?? false,
      disconnectedAt: member.disconnectedAt ?? null,
    }));
    room.phase = snapshot.phase;
    room.progress = structuredClone(snapshot.progress);
    room.settlement = structuredClone(snapshot.settlement ?? null);
    room.timer = snapshot.timer;
    room.trick = structuredClone(snapshot.trick);
    room.turnDeadline = snapshot.turnDeadline ?? null;
    room.tribute = structuredClone(snapshot.tribute ?? null);
    if (snapshot.turnDeadline === undefined) {
      room.refreshTurnDeadline();
    }
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
      sameNickname.controlledByBot = false;
      sameNickname.disconnectedAt = null;
      return this.makeReceipt(sameNickname);
    }

    const seat = this.members.findIndex((member) => member === null);
    if (seat < 0) {
      throw new Error('房间已经坐满');
    }

    const member: RoomMemberState = {
      connected: true,
      connectionId: null,
      controlledByBot: false,
      disconnectedAt: null,
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
    member.connected = true;
    member.controlledByBot = false;
    member.disconnectedAt = null;
    return this.makeReceipt(member);
  }

  attachConnection(sessionId: string, connectionId: string, now = Date.now()): void {
    const member = this.getMember(sessionId);
    if (member.kind !== 'human') {
      throw new Error('机器人不需要网络连接');
    }
    member.connected = true;
    member.connectionId = connectionId;
    member.controlledByBot = false;
    member.disconnectedAt = null;
    this.refreshTurnDeadline(now);
  }

  disconnect(sessionId: string, disconnectedAt = Date.now(), connectionId?: string): void {
    const member = this.getMember(sessionId);
    if (connectionId !== undefined && member.connectionId !== connectionId) {
      return;
    }
    if (member.kind === 'human' && member.connected) {
      member.connected = false;
      member.connectionId = null;
      member.disconnectedAt = disconnectedAt;
      if (member.isHost || this.trick?.currentSeat === member.seat) {
        this.turnDeadline = null;
      }
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
      connectionId: null,
      controlledByBot: false,
      disconnectedAt: null,
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

  start(hostSessionId: string, now = Date.now()): void {
    this.requireLobby();
    this.requireHost(hostSessionId);
    if (this.members.some((member) => member === null)) {
      throw new Error('需要四位玩家全部入座');
    }
    if (this.members.some((member) => member?.kind === 'human' && !member.connected)) {
      throw new Error('有玩家掉线，暂时不能开始牌局');
    }

    const hands = createShuffledDeal(this.random);
    this.members.forEach((member, seat) => {
      if (member !== null) {
        member.hand = hands[seat as Seat];
      }
    });
    const leader = Math.floor(validateRandomSample(this.random()) * 4) as Seat;
    this.trick = createTrickState(leader);
    this.settlement = null;
    this.tribute = null;
    this.phase = 'playing';
    this.refreshTurnDeadline(now);
  }

  startNextDeal(hostSessionId: string, now = Date.now()): void {
    this.requireHost(hostSessionId);
    if (this.phase !== 'complete' || this.trick === null || this.settlement === null) {
      throw new Error('当前还不能开始下一副');
    }
    if (this.settlement.matchWinner !== null) {
      throw new Error('整场比赛已经结束');
    }
    if (this.members.some((member) => member?.kind === 'human' && !member.connected)) {
      throw new Error('有玩家掉线，暂时不能开始下一副');
    }

    const finishOrder = [...this.trick.finishOrder];
    const hands = createShuffledDeal(this.random);
    this.applyHands(hands);
    this.trick = null;
    this.settlement = null;
    this.tribute = beginTributeRound(finishOrder, hands, this.level);
    this.phase = 'tribute';
    this.finishTributeIfReady(now);
  }

  payTribute(sessionId: string, cardId: string, now = Date.now()): void {
    this.requireTributePhase();
    const member = this.getMember(sessionId);
    const transition = submitTribute(
      this.tribute as TributeRoundState,
      this.getHands(),
      member.seat,
      cardId,
    );
    this.applyTributeTransition(transition, now);
  }

  chooseDoubleTribute(sessionId: string, cardId: string, now = Date.now()): void {
    this.requireTributePhase();
    const member = this.getMember(sessionId);
    const transition = chooseDoubleTribute(
      this.tribute as TributeRoundState,
      this.getHands(),
      member.seat,
      cardId,
    );
    this.applyTributeTransition(transition, now);
  }

  returnTribute(sessionId: string, cardId: string, now = Date.now()): void {
    this.requireTributePhase();
    const member = this.getMember(sessionId);
    const transition = submitReturnCard(
      this.tribute as TributeRoundState,
      this.getHands(),
      member.seat,
      cardId,
    );
    this.applyTributeTransition(transition, now);
  }

  play(sessionId: string, cardIds: string[], description?: string, now = Date.now()): RoomPlayEvent {
    if (this.phase !== 'playing' || this.trick === null) {
      throw new Error('牌局当前不能出牌');
    }
    if (this.getPause() !== null) {
      throw new Error('牌局正在等待掉线玩家重连');
    }
    const member = this.getMember(sessionId);
    this.requireUnexpiredTurn(member, now);
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
      const settlement = settleDeal(this.progress, transition.state.finishOrder);
      this.progress = settlement.teams;
      this.level = settlement.nextLevel;
      this.settlement = settlement;
      this.tribute = null;
      this.phase = 'complete';
    }
    this.refreshTurnDeadline(now);
    return {
      cards: [...cards],
      description: play.description,
      player: member.seat,
    };
  }

  pass(sessionId: string, now = Date.now()): void {
    if (this.phase !== 'playing' || this.trick === null) {
      throw new Error('牌局当前不能选择不要');
    }
    if (this.getPause() !== null) {
      throw new Error('牌局正在等待掉线玩家重连');
    }
    const member = this.getMember(sessionId);
    this.requireUnexpiredTurn(member, now);
    this.trick = submitPass(this.trick, member.seat).state;
    this.refreshTurnDeadline(now);
  }

  runCurrentBotTurn(onPlay?: (event: RoomPlayEvent) => void): boolean {
    if (this.getPause() !== null) {
      return false;
    }

    if (this.phase === 'tribute' && this.tribute !== null) {
      return this.runBotTributeAction();
    }

    if (this.phase !== 'playing' || this.trick?.currentSeat === null || this.trick === null) {
      return false;
    }
    const member = this.members[this.trick.currentSeat];
    if (member === null || (member.kind !== 'bot' && !member.controlledByBot)) {
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
      const event = this.play(
        member.id,
        action.play.cards.map((card) => card.id),
        action.play.description,
      );
      onPlay?.(event);
    }
    return true;
  }

  getView(sessionId: string): RoomView {
    const self = this.getMember(sessionId);
    return {
      currentSeat: this.trick?.currentSeat ?? null,
      finishOrder: [...(this.trick?.finishOrder ?? [])],
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
      pause: this.getPause(),
      players: this.members.flatMap((member) => member === null ? [] : [{
        cardCount: member.id === sessionId ? member.hand.length : getPublicCardCount(member.hand.length),
        connected: member.connected,
        controlledByBot: member.controlledByBot,
        isHost: member.isHost,
        kind: member.kind,
        nickname: member.nickname,
        seat: member.seat,
      }]),
      progress: structuredClone(this.progress),
      roomCode: this.roomCode,
      selfSeat: self.seat,
      settlement: structuredClone(this.settlement),
      timer: this.timer,
      turnDeadline: this.turnDeadline,
      tribute: this.getTributeView(self),
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
      settlement: structuredClone(this.settlement),
      timer: this.timer,
      trick: structuredClone(this.trick),
      turnDeadline: this.turnDeadline,
      tribute: structuredClone(this.tribute),
    };
  }

  getSessionIdAtSeat(seat: Seat): string {
    const member = this.members[seat];
    if (member === null) {
      throw new Error('该座位为空');
    }
    return member.id;
  }

  applyDisconnectTimeouts(now = Date.now()): DisconnectEvent[] {
    const events: DisconnectEvent[] = [];

    for (const member of this.members) {
      if (
        member === null
        || member.kind !== 'human'
        || member.connected
        || member.disconnectedAt === null
        || now - member.disconnectedAt < DISCONNECT_GRACE_MS
      ) {
        continue;
      }

      if (member.isHost && this.phase === 'lobby') {
        const replacement = this.findNextConnectedHuman(member.seat);
        if (replacement !== null) {
          member.isHost = false;
          replacement.isHost = true;
          member.disconnectedAt = null;
          events.push({ from: member.seat, to: replacement.seat, type: 'host-transfer' });
        }
        continue;
      }

      if (
        !member.isHost
        && (this.phase === 'playing' || this.phase === 'tribute')
        && !member.controlledByBot
      ) {
        member.controlledByBot = true;
        events.push({ seat: member.seat, type: 'bot-takeover' });
      }
    }

    return events;
  }

  getNextDisconnectDeadline(): number | null {
    const deadlines = this.members.flatMap((member) => {
      if (
        member === null
        || member.kind !== 'human'
        || member.connected
        || member.disconnectedAt === null
        || member.controlledByBot
      ) {
        return [];
      }

      if (member.isHost) {
        return this.phase === 'lobby' && this.findNextConnectedHuman(member.seat) !== null
          ? [member.disconnectedAt + DISCONNECT_GRACE_MS]
          : [];
      }
      return this.phase === 'playing' || this.phase === 'tribute'
        ? [member.disconnectedAt + DISCONNECT_GRACE_MS]
        : [];
    });
    return deadlines.length === 0 ? null : Math.min(...deadlines);
  }

  getNextTurnDeadline(): number | null {
    return this.getPause() === null ? this.turnDeadline : null;
  }

  applyTurnTimeout(now = Date.now(), onPlay?: (event: RoomPlayEvent) => void): boolean {
    if (
      this.phase !== 'playing'
      || this.trick === null
      || this.trick.currentSeat === null
      || this.turnDeadline === null
      || now < this.turnDeadline
      || this.getPause() !== null
    ) {
      return false;
    }

    const member = this.members[this.trick.currentSeat];
    if (member === null || member.kind !== 'human' || member.controlledByBot) {
      this.turnDeadline = null;
      return false;
    }

    this.turnDeadline = null;
    if (this.trick.lastPlay !== null) {
      this.pass(member.id, now);
      return true;
    }

    const choice = member.hand.reduce((smallest, card) => (
      getRankStrength(card.rank, this.level) < getRankStrength(smallest.rank, this.level)
        ? card
        : smallest
    ));
    const play = classifyPlay([choice], this.level)[0];
    if (play === undefined) {
      throw new Error('超时后无法找到可首出的最小单张');
    }
    const event = this.play(member.id, [choice.id], play.description, now);
    onPlay?.(event);
    return true;
  }

  private getPause(): RoomView['pause'] {
    if (this.phase !== 'playing' && this.phase !== 'tribute') {
      return null;
    }
    const host = this.members.find((member) => member?.isHost);
    if (host !== null && host !== undefined && !host.connected) {
      return { kind: 'host', seat: host.seat };
    }

    if (this.phase === 'playing') {
      if (this.trick?.currentSeat === null || this.trick === null) {
        return null;
      }
      const current = this.members[this.trick.currentSeat];
      if (
        current !== null
        && current.kind === 'human'
        && !current.connected
        && !current.controlledByBot
      ) {
        return { kind: 'player', seat: current.seat };
      }
      return null;
    }

    const pendingSeats = this.getPendingTributeSeats();
    const hasAvailableAction = pendingSeats.some((seat) => {
      const member = this.members[seat];
      return member !== null
        && (member.kind === 'bot' || member.controlledByBot || member.connected);
    });
    if (hasAvailableAction) {
      return null;
    }
    const disconnected = pendingSeats
      .map((seat) => this.members[seat])
      .find((member) => member?.kind === 'human' && !member.connected && !member.controlledByBot);
    if (disconnected !== null && disconnected !== undefined) {
      return { kind: 'player', seat: disconnected.seat };
    }
    return null;
  }

  private requireTributePhase(): void {
    if (this.phase !== 'tribute' || this.tribute === null) {
      throw new Error('当前不在贡还牌流程');
    }
    if (this.getPause() !== null) {
      throw new Error('牌局正在等待掉线玩家重连');
    }
  }

  private getHands(): HandsBySeat {
    const hands = {} as HandsBySeat;
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const member = this.members[seat];
      if (member === null) {
        throw new Error('牌局座位数据不完整');
      }
      hands[seat] = member.hand;
    }
    return hands;
  }

  private applyHands(hands: HandsBySeat): void {
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const member = this.members[seat];
      if (member === null) {
        throw new Error('牌局座位数据不完整');
      }
      member.hand = hands[seat];
    }
  }

  private applyTributeTransition(transition: TributeTransition, now: number): void {
    this.applyHands(transition.hands);
    this.tribute = transition.state;
    this.finishTributeIfReady(now);
  }

  private finishTributeIfReady(now: number): void {
    if (this.tribute?.phase !== 'complete') {
      return;
    }
    if (this.tribute.leader === null) {
      throw new Error('贡还牌结束后无法确定首出玩家');
    }
    this.trick = createTrickState(this.tribute.leader);
    this.phase = 'playing';
    this.refreshTurnDeadline(now);
  }

  private refreshTurnDeadline(now = Date.now()): void {
    const duration = getTurnDurationMs(this.timer);
    if (
      duration === null
      || this.phase !== 'playing'
      || this.trick === null
      || this.trick.currentSeat === null
      || this.getPause() !== null
    ) {
      this.turnDeadline = null;
      return;
    }

    const member = this.members[this.trick.currentSeat];
    this.turnDeadline = member !== null
      && member.kind === 'human'
      && member.connected
      && !member.controlledByBot
      ? now + duration
      : null;
  }

  private requireUnexpiredTurn(member: RoomMemberState, now: number): void {
    if (
      member.kind === 'human'
      && !member.controlledByBot
      && this.turnDeadline !== null
      && now >= this.turnDeadline
    ) {
      throw new Error('当前回合已经超时');
    }
  }

  private getPendingTributeSeats(): Seat[] {
    if (this.tribute === null || this.tribute.phase === 'complete') {
      return [];
    }
    if (this.tribute.phase === 'collecting-tributes') {
      return this.tribute.contributorSeats.filter(
        (seat) => !this.tribute?.offers.some((offer) => offer.source === seat),
      );
    }
    if (this.tribute.phase === 'choosing-double-tribute') {
      return [this.tribute.headSeat];
    }
    return this.tribute.assignments
      .filter((assignment) => !this.tribute?.returns.some(
        (record) => record.recipient === assignment.recipient,
      ))
      .map((assignment) => assignment.recipient);
  }

  private getTributeView(self: RoomMemberState): TributeView | null {
    if (this.phase !== 'tribute' || this.tribute === null) {
      return null;
    }

    if (
      this.tribute.phase === 'collecting-tributes'
      && this.tribute.contributorSeats.includes(self.seat)
      && !this.tribute.offers.some((offer) => offer.source === self.seat)
    ) {
      return {
        action: 'pay-tribute',
        choices: getHighestTributeChoices(self.hand, this.level),
        message: '请选择手中点数最高且可进贡的牌',
        mode: this.tribute.mode,
      };
    }

    if (
      this.tribute.phase === 'choosing-double-tribute'
      && this.tribute.headSeat === self.seat
    ) {
      return {
        action: 'choose-double-tribute',
        choices: this.tribute.offers.map((offer) => offer.card),
        message: '请选择自己要接收的贡牌，另一张自动交给队友',
        mode: this.tribute.mode,
      };
    }

    if (
      this.tribute.phase === 'collecting-returns'
      && this.tribute.assignments.some((assignment) => assignment.recipient === self.seat)
      && !this.tribute.returns.some((record) => record.recipient === self.seat)
    ) {
      return {
        action: 'return-tribute',
        choices: getReturnCardChoices(self.hand),
        message: '请选择一张自然点数 2 至 10 的牌还贡',
        mode: this.tribute.mode,
      };
    }

    return {
      action: 'waiting',
      choices: [],
      message: this.tribute.phase === 'collecting-tributes'
        ? '等待进贡方选牌'
        : this.tribute.phase === 'choosing-double-tribute'
          ? '等待头游分配两张贡牌'
          : '等待接贡方完成还贡',
      mode: this.tribute.mode,
    };
  }

  private runBotTributeAction(): boolean {
    if (this.tribute === null || this.phase !== 'tribute') {
      return false;
    }

    const botSeat = this.getPendingTributeSeats().find((seat) => {
      const member = this.members[seat];
      return member !== null && (member.kind === 'bot' || member.controlledByBot);
    });
    if (botSeat === undefined) {
      return false;
    }
    const bot = this.members[botSeat];
    if (bot === null) {
      return false;
    }

    if (this.tribute.phase === 'collecting-tributes') {
      const choice = getHighestTributeChoices(bot.hand, this.level)[0];
      if (choice === undefined) {
        throw new Error('机器人没有可进贡的牌');
      }
      this.payTribute(bot.id, choice.id);
      return true;
    }

    if (this.tribute.phase === 'choosing-double-tribute') {
      const choice = this.tribute.offers.reduce((best, offer) => (
        getRankStrength(offer.card.rank, this.level) > getRankStrength(best.card.rank, this.level)
          ? offer
          : best
      ));
      this.chooseDoubleTribute(bot.id, choice.card.id);
      return true;
    }

    const choice = getReturnCardChoices(bot.hand)[0];
    if (choice === undefined) {
      throw new Error('机器人没有符合规则的还贡牌');
    }
    this.returnTribute(bot.id, choice.id);
    return true;
  }

  private findNextConnectedHuman(after: Seat): RoomMemberState | null {
    for (let offset = 1; offset < 4; offset += 1) {
      const candidate = this.members[((after + offset) % 4) as Seat];
      if (candidate?.kind === 'human' && candidate.connected) {
        return candidate;
      }
    }
    return null;
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
