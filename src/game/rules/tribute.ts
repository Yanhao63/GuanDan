import type { CardData, Rank } from '../types';
import { getRankStrength, isPlainRank, PLAIN_RANKS_ASCENDING } from './ranks';
import { getTeamForSeat, type Seat } from './match';
import type { PlainRank } from './types';

const RETURNABLE_RANKS = new Set<Rank>(['2', '3', '4', '5', '6', '7', '8', '9', '10']);

export function isTributableCard(card: CardData, level: PlainRank): boolean {
  return !(card.rank === level && card.suit === 'hearts');
}

export function getHighestTributeChoices(hand: CardData[], level: PlainRank): CardData[] {
  const eligibleCards = hand.filter((card) => isTributableCard(card, level));
  if (eligibleCards.length === 0) {
    return [];
  }

  const highestStrength = Math.max(
    ...eligibleCards.map((card) => getRankStrength(card.rank, level)),
  );
  return eligibleCards.filter((card) => getRankStrength(card.rank, level) === highestStrength);
}

export function isValidReturnCard(card: CardData): boolean {
  return isPlainRank(card.rank) && RETURNABLE_RANKS.has(card.rank);
}

export function getReturnCardChoices(hand: CardData[]): CardData[] {
  return hand
    .filter(isValidReturnCard)
    .sort((first, second) => {
      if (!isPlainRank(first.rank) || !isPlainRank(second.rank)) {
        return 0;
      }
      return PLAIN_RANKS_ASCENDING.indexOf(first.rank)
        - PLAIN_RANKS_ASCENDING.indexOf(second.rank);
    });
}

export function isSingleTributeResisted(lastPlaceHand: CardData[]): boolean {
  return lastPlaceHand.filter((card) => card.rank === '大王').length === 2;
}

export function isDoubleTributeResisted(losingHands: [CardData[], CardData[]]): boolean {
  return losingHands.flat().filter((card) => card.rank === '大王').length === 2;
}

interface TributeSource {
  card: CardData;
  seat: Seat;
}

export type TributeMode = 'single' | 'double';
export type TributePhase =
  | 'collecting-tributes'
  | 'choosing-double-tribute'
  | 'collecting-returns'
  | 'complete';

export type HandsBySeat = Record<Seat, CardData[]>;

export interface TributeOffer {
  card: CardData;
  source: Seat;
}

export interface TributeAssignment extends TributeOffer {
  recipient: Seat;
}

export interface ReturnRecord {
  card: CardData;
  recipient: Seat;
  source: Seat;
}

export interface TributeRoundState {
  assignments: TributeAssignment[];
  contributorSeats: Seat[];
  headSeat: Seat;
  leader: Seat | null;
  level: PlainRank;
  mode: TributeMode;
  offers: TributeOffer[];
  phase: TributePhase;
  recipientSeats: Seat[];
  resisted: boolean;
  returns: ReturnRecord[];
}

export interface TributeTransition {
  hands: HandsBySeat;
  state: TributeRoundState;
}

function cloneHands(hands: HandsBySeat): HandsBySeat {
  return {
    0: [...hands[0]],
    1: [...hands[1]],
    2: [...hands[2]],
    3: [...hands[3]],
  };
}

function validateFinishOrder(finishOrder: Seat[]): void {
  const isDoubleDown = finishOrder.length === 2
    && getTeamForSeat(finishOrder[0]) === getTeamForSeat(finishOrder[1]);
  if (
    (!isDoubleDown && finishOrder.length !== 4)
    || new Set(finishOrder).size !== finishOrder.length
  ) {
    throw new Error('进贡结算需要同队前两名，或四个不重复座位的完整名次');
  }
}

function findCard(hand: CardData[], cardId: string): CardData {
  const card = hand.find((candidate) => candidate.id === cardId);
  if (card === undefined) {
    throw new Error('所选牌不在该玩家手中');
  }
  return card;
}

function moveCard(
  hands: HandsBySeat,
  card: CardData,
  from: Seat,
  to: Seat,
): HandsBySeat {
  const nextHands = cloneHands(hands);
  nextHands[from] = nextHands[from].filter((candidate) => candidate.id !== card.id);
  nextHands[to] = [...nextHands[to], card];
  return nextHands;
}

function getDoubleContributors(headSeat: Seat): [Seat, Seat] {
  return [
    ((headSeat + 1) % 4) as Seat,
    ((headSeat + 3) % 4) as Seat,
  ];
}

export function beginTributeRound(
  finishOrder: Seat[],
  hands: HandsBySeat,
  level: PlainRank,
): TributeRoundState {
  validateFinishOrder(finishOrder);
  const headSeat = finishOrder[0];
  const isDouble = getTeamForSeat(finishOrder[0]) === getTeamForSeat(finishOrder[1]);
  const mode: TributeMode = isDouble ? 'double' : 'single';
  const contributorSeats = isDouble
    ? getDoubleContributors(headSeat)
    : [finishOrder[3]];
  const recipientSeats = isDouble
    ? [headSeat, finishOrder[1]]
    : [headSeat];
  const resisted = isDouble
    ? isDoubleTributeResisted([
        hands[contributorSeats[0]],
        hands[contributorSeats[1]],
      ])
    : isSingleTributeResisted(hands[contributorSeats[0]]);

  return {
    assignments: [],
    contributorSeats,
    headSeat,
    leader: resisted ? headSeat : null,
    level,
    mode,
    offers: [],
    phase: resisted ? 'complete' : 'collecting-tributes',
    recipientSeats,
    resisted,
    returns: [],
  };
}

export function submitTribute(
  state: TributeRoundState,
  hands: HandsBySeat,
  source: Seat,
  cardId: string,
): TributeTransition {
  if (state.phase !== 'collecting-tributes') {
    throw new Error('当前不在进贡选牌阶段');
  }
  if (!state.contributorSeats.includes(source)) {
    throw new Error('该玩家不需要进贡');
  }
  if (state.offers.some((offer) => offer.source === source)) {
    throw new Error('该玩家已经完成进贡');
  }

  const card = findCard(hands[source], cardId);
  const highestChoices = getHighestTributeChoices(hands[source], state.level);
  if (!highestChoices.some((choice) => choice.id === card.id)) {
    throw new Error('必须进贡手中点数最高且可进贡的牌');
  }

  const nextHands = cloneHands(hands);
  nextHands[source] = nextHands[source].filter((candidate) => candidate.id !== card.id);
  const offers = [...state.offers, { card, source }];

  if (state.mode === 'single') {
    const assignment: TributeAssignment = {
      card,
      recipient: state.headSeat,
      source,
    };
    nextHands[state.headSeat] = [...nextHands[state.headSeat], card];
    return {
      hands: nextHands,
      state: {
        ...state,
        assignments: [assignment],
        offers,
        phase: 'collecting-returns',
      },
    };
  }

  return {
    hands: nextHands,
    state: {
      ...state,
      offers,
      phase: offers.length === state.contributorSeats.length
        ? 'choosing-double-tribute'
        : 'collecting-tributes',
    },
  };
}

export function chooseDoubleTribute(
  state: TributeRoundState,
  hands: HandsBySeat,
  chooser: Seat,
  cardId: string,
): TributeTransition {
  if (state.mode !== 'double' || state.phase !== 'choosing-double-tribute') {
    throw new Error('当前不需要分配双贡牌');
  }
  if (chooser !== state.headSeat) {
    throw new Error('只有头游可以选择双贡牌');
  }

  const selected = state.offers.find((offer) => offer.card.id === cardId);
  if (selected === undefined) {
    throw new Error('所选牌不在两张贡牌中');
  }
  const remaining = state.offers.find((offer) => offer.card.id !== cardId);
  const teammate = state.recipientSeats.find((seat) => seat !== state.headSeat);
  if (remaining === undefined || teammate === undefined) {
    throw new Error('双贡牌或接收者数据不完整');
  }

  const assignments: TributeAssignment[] = [
    { ...selected, recipient: state.headSeat },
    { ...remaining, recipient: teammate },
  ];
  const nextHands = cloneHands(hands);
  for (const assignment of assignments) {
    nextHands[assignment.recipient] = [
      ...nextHands[assignment.recipient],
      assignment.card,
    ];
  }

  return {
    hands: nextHands,
    state: {
      ...state,
      assignments,
      phase: 'collecting-returns',
    },
  };
}

export function submitReturnCard(
  state: TributeRoundState,
  hands: HandsBySeat,
  recipient: Seat,
  cardId: string,
): TributeTransition {
  if (state.phase !== 'collecting-returns') {
    throw new Error('当前不在还贡阶段');
  }
  const assignment = state.assignments.find((candidate) => candidate.recipient === recipient);
  if (assignment === undefined) {
    throw new Error('该玩家不需要还贡');
  }
  if (state.returns.some((record) => record.recipient === recipient)) {
    throw new Error('该玩家已经完成还贡');
  }

  const card = findCard(hands[recipient], cardId);
  if (!isValidReturnCard(card)) {
    throw new Error('还贡牌必须是自然点数 2 至 10');
  }

  const nextHands = moveCard(hands, card, recipient, assignment.source);
  const returns = [
    ...state.returns,
    { card, recipient, source: assignment.source },
  ];
  const complete = returns.length === state.assignments.length;
  const leader = !complete
    ? null
    : state.mode === 'single'
      ? state.contributorSeats[0]
      : getDoubleTributeLeader(
          { card: state.offers[0].card, seat: state.offers[0].source },
          { card: state.offers[1].card, seat: state.offers[1].source },
          state.headSeat,
          state.level,
        );

  return {
    hands: nextHands,
    state: {
      ...state,
      leader,
      phase: complete ? 'complete' : 'collecting-returns',
      returns,
    },
  };
}

export function getDoubleTributeLeader(
  first: TributeSource,
  second: TributeSource,
  previousHeadSeat: Seat,
  level: PlainRank,
): Seat {
  const firstStrength = getRankStrength(first.card.rank, level);
  const secondStrength = getRankStrength(second.card.rank, level);

  if (firstStrength === secondStrength) {
    return ((previousHeadSeat + 1) % 4) as Seat;
  }
  return firstStrength > secondStrength ? first.seat : second.seat;
}
