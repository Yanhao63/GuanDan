import type { CardData, Rank } from '../types';
import { getRankStrength, isPlainRank } from './ranks';
import type { Seat } from './match';
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
