import { useEffect } from 'react';
import type { NetworkPlayEvent } from '../game/network';
import type { RoomPlayEvent } from '../game/room';
import type { Seat } from '../game/rules/match';
import type { PlainRank } from '../game/rules/types';
import { PokerCard } from './PokerCard';

export type TableDirection = 'self' | 'right' | 'top' | 'left';

const directionArrows: Record<TableDirection, string> = {
  left: '←',
  right: '→',
  self: '↓',
  top: '↑',
};

export function getTableDirection(selfSeat: Seat, sourceSeat: Seat): TableDirection {
  const offset = (sourceSeat - selfSeat + 4) % 4;
  if (offset === 1) {
    return 'right';
  }
  if (offset === 2) {
    return 'top';
  }
  if (offset === 3) {
    return 'left';
  }
  return 'self';
}

interface TurnIndicatorProps {
  direction: TableDirection;
  nickname: string;
}

export function TurnIndicator({ direction, nickname }: TurnIndicatorProps) {
  return (
    <div
      aria-label={`当前由 ${nickname} 出牌`}
      aria-live="polite"
      className={`turn-indicator turn-indicator-${direction}`}
    >
      <span aria-hidden="true" className="turn-indicator-arrow">{directionArrows[direction]}</span>
      <span>当前出牌</span>
      <strong>{direction === 'self' ? '轮到你' : nickname}</strong>
    </div>
  );
}

interface DirectionalPlayProps {
  activeEvent: NetworkPlayEvent | null;
  fallbackPlay: RoomPlayEvent | null;
  level: PlainRank;
  onAnimationComplete: () => void;
  selfSeat: Seat;
}

export function DirectionalPlay({
  activeEvent,
  fallbackPlay,
  level,
  onAnimationComplete,
  selfSeat,
}: DirectionalPlayProps) {
  const displayedPlay = activeEvent ?? fallbackPlay;
  const direction = displayedPlay === null
    ? null
    : getTableDirection(selfSeat, displayedPlay.player);

  useEffect(() => {
    if (activeEvent === null) {
      return undefined;
    }
    const timeout = window.setTimeout(onAnimationComplete, 600);
    return () => window.clearTimeout(timeout);
  }, [activeEvent, onAnimationComplete]);

  if (displayedPlay === null || direction === null) {
    return (
      <div className="table-seal" aria-hidden="true">
        <span>贯</span><small>以牌会友</small>
      </div>
    );
  }

  if (displayedPlay.cards.length === 0) {
    return (
      <div
        aria-label={`${displayedPlay.player + 1} 号座位选择不要`}
        className={activeEvent === null
          ? 'pass-flight played-card-static'
          : `pass-flight played-card-from-${direction}`}
      >
        <span>不要</span>
      </div>
    );
  }

  return displayedPlay.cards.map((card, index) => (
    <div
      className={activeEvent === null
        ? 'played-card-flight played-card-static'
        : `played-card-flight played-card-from-${direction}`}
      key={`${activeEvent?.id ?? 'table'}-${card.id}`}
      style={{ animationDelay: `${index * 18}ms` }}
    >
      <div
        className="played-card"
        style={{ transform: `translateX(${index * 34}px) rotate(${(index - 1) * 2}deg)` }}
      >
        <PokerCard card={card} index={index} level={level} onToggle={() => undefined} selected={false} />
      </div>
    </div>
  ));
}
