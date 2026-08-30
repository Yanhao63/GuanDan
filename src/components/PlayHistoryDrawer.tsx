import { useEffect, useMemo, useState } from 'react';
import type { RoomDealHistory, RoomHistoryEntry, RoomPlayerView } from '../game/room';
import type { Seat } from '../game/rules/match';
import type { CardData } from '../game/types';
import { Icon } from '../ui/Icon';
import { getTableDirection, type TableDirection } from './TableActivity';

interface PlayHistoryDrawerProps {
  history: RoomDealHistory[];
  onClose: () => void;
  players: RoomPlayerView[];
  selfSeat: Seat;
}

const directionLabels: Record<TableDirection, string> = {
  left: '左手边',
  right: '右手边',
  self: '你',
  top: '对家',
};

const suitGlyph = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  joker: '★',
  spades: '♠',
} as const;

function HistoryCard({ card }: { card: CardData }) {
  const isRed = card.suit === 'diamonds' || card.suit === 'hearts';
  return (
    <span
      aria-label={`${card.rank}${card.suit === 'joker' ? '' : suitGlyph[card.suit]}`}
      className={`history-card${isRed ? ' history-card-red' : ''}`}
    >
      <strong>{card.rank}</strong>
      <span>{suitGlyph[card.suit]}</span>
    </span>
  );
}

function getHistoryActionLabel(entry: RoomHistoryEntry): string {
  if (entry.kind === 'pass') {
    return '不要';
  }
  if (entry.kind === 'tribute') {
    return '进贡';
  }
  if (entry.kind === 'return-tribute') {
    return '还贡';
  }
  return entry.description;
}

export function PlayHistoryDrawer({ history, onClose, players, selfSeat }: PlayHistoryDrawerProps) {
  const latestDealNumber = history.at(-1)?.dealNumber ?? 0;
  const [selectedDealNumber, setSelectedDealNumber] = useState(latestDealNumber);
  const selectedDeal = history.find((deal) => deal.dealNumber === selectedDealNumber)
    ?? history.at(-1);
  const newestFirst = useMemo(
    () => selectedDeal === undefined ? [] : [...selectedDeal.entries].reverse(),
    [selectedDeal],
  );

  useEffect(() => {
    if (!history.some((deal) => deal.dealNumber === selectedDealNumber)) {
      setSelectedDealNumber(latestDealNumber);
    }
  }, [history, latestDealNumber, selectedDealNumber]);

  return (
    <aside aria-label="牌局历史" className="history-drawer">
      <div className="drawer-header">
        <div className="history-title">
          <span>牌桌留痕</span>
          <strong>牌局历史</strong>
        </div>
        <button aria-label="关闭牌局历史" className="icon-button" onClick={onClose} type="button"><Icon name="close" /></button>
      </div>

      <nav aria-label="选择要查看的牌局" className="history-deal-tabs">
        {[...history].reverse().map((deal) => (
          <button
            aria-current={deal.dealNumber === selectedDeal?.dealNumber ? 'page' : undefined}
            className={deal.dealNumber === selectedDeal?.dealNumber ? 'history-deal-tab history-deal-tab-active' : 'history-deal-tab'}
            key={deal.dealNumber}
            onClick={() => setSelectedDealNumber(deal.dealNumber)}
            type="button"
          >
            第 {deal.dealNumber} 副
            {deal.dealNumber === latestDealNumber ? <small>当前</small> : null}
          </button>
        ))}
      </nav>

      <div className="history-scroll">
        {newestFirst.length === 0 ? (
          <div className="history-empty">
            <span aria-hidden="true">留</span>
            <strong>还没有出牌记录</strong>
            <p>本副牌开始行动后，这里会按最新在前记录贡还牌、出牌与“不要”。</p>
          </div>
        ) : newestFirst.map((entry, index) => {
          const player = players.find((candidate) => candidate.seat === entry.player);
          const direction = getTableDirection(selfSeat, entry.player);
          const kindClass = entry.kind === 'pass'
            ? ' history-entry-pass'
            : entry.kind === 'tribute'
              ? ' history-entry-tribute'
              : entry.kind === 'return-tribute'
                ? ' history-entry-return'
                : '';
          return (
            <article className={`history-entry${kindClass}`} key={entry.id}>
              <div className="history-entry-marker"><span>{newestFirst.length - index}</span></div>
              <div className="history-entry-body">
                <div className="history-entry-heading">
                  <div><strong>{player?.nickname ?? `座位 ${entry.player + 1}`}</strong><span>{directionLabels[direction]}</span></div>
                  <em>{getHistoryActionLabel(entry)}</em>
                </div>
                {entry.cards.length > 0 ? (
                  <div className="history-cards">
                    {entry.cards.map((card) => <HistoryCard card={card} key={card.id} />)}
                  </div>
                ) : <p className="history-pass-copy">选择不要，轮到下一位</p>}
              </div>
            </article>
          );
        })}
      </div>
      <p className="history-retention">仅保留最近两副牌 · 最新记录在前</p>
    </aside>
  );
}
