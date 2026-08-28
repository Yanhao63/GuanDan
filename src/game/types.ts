export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds' | 'joker';

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | '小王'
  | '大王';

export interface CardData {
  id: string;
  rank: Rank;
  suit: Suit;
  deck: 1 | 2;
}

export type PlayerKind = 'human' | 'bot';

export interface RoomPlayer {
  id: string;
  nickname: string;
  kind: PlayerKind;
  isHost: boolean;
  isReady: boolean;
  seat: 0 | 1 | 2 | 3;
}

export type TimerChoice = '不限时' | '30秒' | '60秒' | '90秒';
