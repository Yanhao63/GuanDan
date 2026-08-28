import type { CardData, Rank, Suit } from './types';
import type { Seat } from './rules/match';

const SUITS: Exclude<Suit, 'joker'>[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS: Exclude<Rank, '小王' | '大王'>[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
];

export type RandomSource = () => number;
export type Deal = Record<Seat, CardData[]>;

export function createDeck(): CardData[] {
  return ([1, 2] as const).flatMap((deck) => [
    ...SUITS.flatMap((suit) => RANKS.map((rank) => ({
      id: `${deck}-${suit}-${rank}`,
      rank,
      suit,
      deck,
    } satisfies CardData))),
    { id: `${deck}-joker-small`, rank: '小王', suit: 'joker', deck } satisfies CardData,
    { id: `${deck}-joker-big`, rank: '大王', suit: 'joker', deck } satisfies CardData,
  ]);
}

export function shuffleDeck(cards: CardData[], random: RandomSource): CardData[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new Error('随机数源必须返回大于等于 0 且小于 1 的数');
    }
    const swapIndex = Math.floor(sample * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function dealFourHands(shuffledDeck: CardData[]): Deal {
  if (shuffledDeck.length !== 108 || new Set(shuffledDeck.map((card) => card.id)).size !== 108) {
    throw new Error('发牌前必须提供 108 张不重复的实体牌');
  }

  const hands: Deal = { 0: [], 1: [], 2: [], 3: [] };
  shuffledDeck.forEach((card, index) => {
    hands[(index % 4) as Seat].push(card);
  });
  return hands;
}

export function createShuffledDeal(random: RandomSource): Deal {
  return dealFourHands(shuffleDeck(createDeck(), random));
}
