import { Icon } from '../ui/Icon';

interface PlayerSeatProps {
  cardCount?: number;
  isActive?: boolean;
  isTeammate?: boolean;
  name: string;
  position: 'top' | 'left' | 'right';
  status?: string;
}

export function PlayerSeat({
  cardCount,
  isActive = false,
  isTeammate = false,
  name,
  position,
  status = '思考中',
}: PlayerSeatProps) {
  return (
    <section className={`player-seat player-seat-${position}${isActive ? ' player-seat-active' : ''}`}>
      <div className="seat-avatar">
        <span aria-hidden="true">{name.slice(0, 1)}</span>
        {isActive ? <span className="countdown-ring" /> : null}
      </div>
      <div className="player-meta">
        <div className="player-name-row">
          <strong>{name}</strong>
          {isTeammate ? <span className="team-tag">队友</span> : null}
        </div>
        <span>{status}</span>
      </div>
      <div className="opponent-hand" aria-label={cardCount === undefined ? '手牌多于十张' : `剩余 ${cardCount} 张`}>
        <img alt="" src="/assets/cards/card-back.png" />
        <img alt="" src="/assets/cards/card-back.png" />
        <img alt="" src="/assets/cards/card-back.png" />
        {cardCount === undefined ? <span>十张以上</span> : <span>{cardCount} 张</span>}
      </div>
      {isActive ? <div className="turn-badge"><Icon name="rotate" size={15} /> 当前回合</div> : null}
    </section>
  );
}
