import type { CSSProperties } from 'react';
import type { CardData } from '../game/types';

interface PokerCardProps {
  card: CardData;
  index: number;
  selected: boolean;
  onToggle: (cardId: string) => void;
}

const suitGlyph = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
  joker: '★',
} as const;

export function PokerCard({ card, index, selected, onToggle }: PokerCardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const isWild = card.rank === '2' && card.suit === 'hearts';
  const style = { '--card-index': index } as CSSProperties;

  return (
    <button
      aria-label={`${isWild ? '百搭' : ''}${card.rank}${card.suit === 'joker' ? '' : suitGlyph[card.suit]}`}
      aria-pressed={selected}
      className={`poker-card${isRed ? ' poker-card-red' : ''}${selected ? ' poker-card-selected' : ''}${isWild ? ' poker-card-wild' : ''}`}
      onClick={() => onToggle(card.id)}
      style={style}
      type="button"
    >
      <span className="card-corner">
        <strong>{card.rank}</strong>
        <span>{suitGlyph[card.suit]}</span>
      </span>
      <span className="card-center" aria-hidden="true">{suitGlyph[card.suit]}</span>
      {isWild ? <span className="wild-ribbon">百搭</span> : null}
    </button>
  );
}
