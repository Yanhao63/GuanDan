import type { CardData, Rank, Suit } from './types';
import { getRankStrength } from './rules/ranks';
import type { PlainRank } from './rules/types';

const card = (rank: Rank, suit: Suit, deck: 1 | 2): CardData => ({
  id: `${deck}-${suit}-${rank}`,
  rank,
  suit,
  deck,
});

export const demoHand: CardData[] = [
  card('大王', 'joker', 1),
  card('小王', 'joker', 2),
  card('2', 'hearts', 1),
  card('2', 'hearts', 2),
  card('A', 'spades', 1),
  card('A', 'diamonds', 2),
  card('K', 'hearts', 1),
  card('K', 'clubs', 2),
  card('Q', 'spades', 1),
  card('Q', 'hearts', 2),
  card('J', 'diamonds', 1),
  card('J', 'spades', 2),
  card('10', 'spades', 1),
  card('10', 'hearts', 2),
  card('9', 'clubs', 1),
  card('9', 'diamonds', 2),
  card('8', 'hearts', 1),
  card('8', 'spades', 2),
  card('7', 'diamonds', 1),
  card('7', 'clubs', 2),
  card('6', 'spades', 1),
  card('6', 'hearts', 2),
  card('5', 'clubs', 1),
  card('4', 'diamonds', 2),
  card('3', 'spades', 1),
  card('3', 'hearts', 2),
  card('2', 'clubs', 1),
];

const suitOrder: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds', 'joker'];

export function sortDemoHand(cards: CardData[], level: PlainRank): CardData[] {
  return [...cards].sort((left, right) => {
    const rankDifference = getRankStrength(right.rank, level) - getRankStrength(left.rank, level);
    if (rankDifference !== 0) {
      return rankDifference;
    }
    return suitOrder.indexOf(left.suit) - suitOrder.indexOf(right.suit);
  });
}
