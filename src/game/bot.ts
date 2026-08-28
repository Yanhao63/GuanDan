import { classifyPlay } from './rules/classify';
import { comparePlays } from './rules/compare';
import { getTeamForSeat, type Seat } from './rules/match';
import {
  CONSECUTIVE_PAIR_SEQUENCES,
  FIVE_CARD_SEQUENCES,
  PLAIN_RANKS_ASCENDING,
  STEEL_PLATE_SEQUENCES,
} from './rules/ranks';
import type { PlainRank, PlainSuit, PlayInterpretation } from './rules/types';
import type { CardData } from './types';

const PLAIN_SUITS: PlainSuit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export type BotAction =
  | { type: 'pass' }
  | { play: PlayInterpretation; type: 'play' };

interface BotTurnContext {
  botSeat: Seat;
  hand: CardData[];
  lastPlay: PlayInterpretation | null;
  lastPlayer: Seat | null;
  level: PlainRank;
}

function isWildcard(card: CardData, level: PlainRank): boolean {
  return card.rank === level && card.suit === 'hearts';
}

function pickCardsForCounts(
  hand: CardData[],
  level: PlainRank,
  counts: Map<PlainRank, number>,
  suit?: PlainSuit,
): CardData[] | null {
  const wildcards = hand.filter((card) => isWildcard(card, level));
  const selected: CardData[] = [];
  let wildcardsNeeded = 0;

  for (const [rank, count] of counts) {
    const fixedCards = hand.filter((card) =>
      !isWildcard(card, level)
      && card.rank === rank
      && (suit === undefined || card.suit === suit),
    ).slice(0, count);
    selected.push(...fixedCards);
    wildcardsNeeded += count - fixedCards.length;
  }

  if (wildcardsNeeded > wildcards.length) {
    return null;
  }
  return [...selected, ...wildcards.slice(0, wildcardsNeeded)];
}

function addCandidate(
  candidates: PlayInterpretation[],
  cards: CardData[] | null,
  level: PlainRank,
): void {
  if (cards === null) {
    return;
  }
  candidates.push(...classifyPlay(cards, level));
}

function deduplicatePlays(plays: PlayInterpretation[]): PlayInterpretation[] {
  const seen = new Set<string>();
  return plays.filter((play) => {
    const cardIds = play.cards.map((card) => card.id).sort().join(',');
    const assignments = play.wildcardAssignments
      .map((assignment) => `${assignment.cardId}:${assignment.represents.rank}:${assignment.represents.suit ?? ''}`)
      .sort()
      .join(',');
    const key = `${play.kind}:${play.primaryStrength}:${cardIds}:${assignments}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function enumerateLegalPlays(hand: CardData[], level: PlainRank): PlayInterpretation[] {
  const candidates: PlayInterpretation[] = hand.flatMap((card) => classifyPlay([card], level));

  for (const rank of PLAIN_RANKS_ASCENDING) {
    for (const count of [2, 3] as const) {
      addCandidate(candidates, pickCardsForCounts(hand, level, new Map([[rank, count]])), level);
    }

    const fixedCount = hand.filter((card) => card.rank === rank && !isWildcard(card, level)).length;
    const wildcardCount = hand.filter((card) => isWildcard(card, level)).length;
    for (let count = 4; count <= Math.min(10, fixedCount + wildcardCount); count += 1) {
      addCandidate(candidates, pickCardsForCounts(hand, level, new Map([[rank, count]])), level);
    }
  }

  for (const tripleRank of PLAIN_RANKS_ASCENDING) {
    for (const pairRank of PLAIN_RANKS_ASCENDING) {
      if (tripleRank !== pairRank) {
        addCandidate(candidates, pickCardsForCounts(
          hand,
          level,
          new Map([[tripleRank, 3], [pairRank, 2]]),
        ), level);
      }
    }
  }

  for (const sequence of FIVE_CARD_SEQUENCES) {
    const counts = new Map(sequence.ranks.map((rank) => [rank, 1]));
    addCandidate(candidates, pickCardsForCounts(hand, level, counts), level);
    for (const suit of PLAIN_SUITS) {
      addCandidate(candidates, pickCardsForCounts(hand, level, counts, suit), level);
    }
  }

  for (const sequence of CONSECUTIVE_PAIR_SEQUENCES) {
    addCandidate(candidates, pickCardsForCounts(
      hand,
      level,
      new Map(sequence.ranks.map((rank) => [rank, 2])),
    ), level);
  }

  for (const sequence of STEEL_PLATE_SEQUENCES) {
    addCandidate(candidates, pickCardsForCounts(
      hand,
      level,
      new Map(sequence.ranks.map((rank) => [rank, 3])),
    ), level);
  }

  const fourJokers = hand.filter((card) => card.suit === 'joker');
  if (fourJokers.length === 4) {
    addCandidate(candidates, fourJokers, level);
  }

  return deduplicatePlays(candidates);
}

function playScore(play: PlayInterpretation, isLeading: boolean): number {
  const bombPenalty = play.bombTier > 0 ? 10_000 + play.bombTier * 10 : 0;
  const wildcardPenalty = play.wildcardAssignments.length * 20;
  const sheddingBonus = isLeading ? play.cardCount * -100 : 0;
  return bombPenalty + wildcardPenalty + sheddingBonus + play.primaryStrength;
}

export function chooseBotAction(context: BotTurnContext): BotAction {
  const teammateControlsTable = context.lastPlayer !== null
    && getTeamForSeat(context.lastPlayer) === getTeamForSeat(context.botSeat);
  if (context.lastPlay !== null && teammateControlsTable) {
    return { type: 'pass' };
  }

  const legalPlays = enumerateLegalPlays(context.hand, context.level)
    .filter((play) => context.lastPlay === null || comparePlays(play, context.lastPlay).canBeat);
  if (legalPlays.length === 0) {
    return { type: 'pass' };
  }

  const isLeading = context.lastPlay === null;
  let bestPlay = legalPlays[0];
  let bestScore = playScore(bestPlay, isLeading);
  for (let index = 1; index < legalPlays.length; index += 1) {
    const candidate = legalPlays[index];
    const candidateScore = playScore(candidate, isLeading);
    if (candidateScore < bestScore) {
      bestPlay = candidate;
      bestScore = candidateScore;
    }
  }

  return { type: 'play', play: bestPlay };
}
