import type { CardData, Rank, Suit } from '../types';

export type PlainRank = Exclude<Rank, '小王' | '大王'>;
export type PlainSuit = Exclude<Suit, 'joker'>;

export type PlayKind =
  | 'single'
  | 'pair'
  | 'triple'
  | 'triple-with-pair'
  | 'straight'
  | 'consecutive-pairs'
  | 'steel-plate'
  | 'bomb'
  | 'straight-flush'
  | 'four-jokers';

export interface RepresentedCard {
  rank: PlainRank;
  suit?: PlainSuit;
}

export interface WildcardAssignment {
  cardId: string;
  represents: RepresentedCard;
}

export interface PlayInterpretation {
  kind: PlayKind;
  cards: CardData[];
  primaryRank: Rank;
  primaryStrength: number;
  cardCount: number;
  bombTier: number;
  wildcardAssignments: WildcardAssignment[];
  description: string;
}

export interface PlayComparison {
  canBeat: boolean;
  reason: 'higher' | 'equal' | 'lower' | 'different-kind' | 'different-size' | 'bomb-required';
}
