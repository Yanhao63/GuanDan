import type { Rank } from '../types';
import type { PlainRank } from './types';

export const PLAIN_RANKS_ASCENDING: PlainRank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
];

export interface SequencePattern {
  ranks: PlainRank[];
  strength: number;
  label: string;
}

export const FIVE_CARD_SEQUENCES: SequencePattern[] = [
  { ranks: ['A', '2', '3', '4', '5'], strength: 0, label: 'A-2-3-4-5' },
  { ranks: ['2', '3', '4', '5', '6'], strength: 1, label: '2-3-4-5-6' },
  { ranks: ['3', '4', '5', '6', '7'], strength: 2, label: '3-4-5-6-7' },
  { ranks: ['4', '5', '6', '7', '8'], strength: 3, label: '4-5-6-7-8' },
  { ranks: ['5', '6', '7', '8', '9'], strength: 4, label: '5-6-7-8-9' },
  { ranks: ['6', '7', '8', '9', '10'], strength: 5, label: '6-7-8-9-10' },
  { ranks: ['7', '8', '9', '10', 'J'], strength: 6, label: '7-8-9-10-J' },
  { ranks: ['8', '9', '10', 'J', 'Q'], strength: 7, label: '8-9-10-J-Q' },
  { ranks: ['9', '10', 'J', 'Q', 'K'], strength: 8, label: '9-10-J-Q-K' },
  { ranks: ['10', 'J', 'Q', 'K', 'A'], strength: 9, label: '10-J-Q-K-A' },
];

export function isPlainRank(rank: Rank): rank is PlainRank {
  return rank !== '小王' && rank !== '大王';
}

export function getRankStrength(rank: Rank, level: PlainRank): number {
  if (rank === '大王') {
    return 15;
  }
  if (rank === '小王') {
    return 14;
  }
  if (rank === level) {
    return 13;
  }

  const ranksWithoutLevel = PLAIN_RANKS_ASCENDING.filter((candidate) => candidate !== level);
  return ranksWithoutLevel.indexOf(rank);
}

export function getBombTier(kind: 'bomb' | 'straight-flush' | 'four-jokers', cardCount: number): number {
  if (kind === 'four-jokers') {
    return 90;
  }
  if (kind === 'straight-flush') {
    return 30;
  }

  if (cardCount >= 6) {
    return 30 + (cardCount - 5) * 10;
  }
  return cardCount === 5 ? 20 : 10;
}
