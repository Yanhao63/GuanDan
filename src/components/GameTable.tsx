import { useMemo, useState } from 'react';
import { sortDemoHand } from '../game/demoCards';
import { classifyPlay } from '../game/rules/classify';
import type { RoomPlayerView, RoomView } from '../game/room';
import type { Seat } from '../game/rules/match';
import type { PlayInterpretation } from '../game/rules/types';
import { Icon } from '../ui/Icon';
import { PlayerSeat } from './PlayerSeat';
import { PokerCard } from './PokerCard';
import { QuickChatDrawer } from './QuickChatDrawer';
import { TopHud } from './TopHud';
import { WildcardModal } from './WildcardModal';

interface GameTableProps {
  notice?: string;
  onPass: () => void;
  onPlay: (cardIds: string[], description: string) => void;
  onQuickMessage: (message: string) => void;
  view: RoomView;
}

function relativeSeat(selfSeat: Seat, offset: 1 | 2 | 3): Seat {
  return ((selfSeat + offset) % 4) as Seat;
}

function playerAt(view: RoomView, seat: Seat): RoomPlayerView {
  const player = view.players.find((candidate) => candidate.seat === seat);
  if (player === undefined) {
    throw new Error('牌局座位数据不完整');
  }
  return player;
}

export function GameTable({ notice = '', onPass, onPlay, onQuickMessage, view }: GameTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showWildcard, setShowWildcard] = useState(false);
  const [wildcardOptions, setWildcardOptions] = useState<PlayInterpretation[]>([]);
  const [localMessage, setLocalMessage] = useState('');
  const [speech, setSpeech] = useState<string | null>(null);

  const hand = useMemo(() => sortDemoHand(view.hand, view.level), [view.hand, view.level]);
  const topPlayer = playerAt(view, relativeSeat(view.selfSeat, 2));
  const leftPlayer = playerAt(view, relativeSeat(view.selfSeat, 3));
  const rightPlayer = playerAt(view, relativeSeat(view.selfSeat, 1));
  const selfPlayer = playerAt(view, view.selfSeat);
  const isSelfTurn = view.currentSeat === view.selfSeat;
  const tableMessage = notice.length > 0
    ? notice
    : localMessage.length > 0
      ? localMessage
      : view.lastPlay?.description ?? '等待首出';
  const playedCards = view.lastPlay?.cards ?? [];

  const selectedCards = useMemo(
    () => hand.filter((card) => selectedIds.includes(card.id)),
    [hand, selectedIds],
  );

  const toggleCard = (cardId: string) => {
    setSelectedIds((current) => current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]);
  };

  const commitPlay = (wildcardChoice?: PlayInterpretation) => {
    const choice = wildcardChoice ?? wildcardOptions[0];
    if (choice === undefined) {
      return;
    }
    onPlay(selectedIds, choice.description);
    setSelectedIds([]);
    setShowWildcard(false);
    setWildcardOptions([]);
    setLocalMessage('');
  };

  const handlePlay = () => {
    const interpretations = classifyPlay(selectedCards, '2');

    if (interpretations.length > 1) {
      setWildcardOptions(interpretations);
      setShowWildcard(true);
      return;
    }
    if (interpretations.length === 0) {
      setLocalMessage('所选手牌不是合法牌型');
      return;
    }
    commitPlay(interpretations[0]);
  };

  const sendMessage = (message: string) => {
    setSpeech(message);
    setShowChat(false);
    onQuickMessage(message);
  };

  return (
    <main className="game-screen">
      <TopHud level={view.level} roomCode={view.roomCode} timerLabel={view.timer} />

      <div className="table-canvas">
        <PlayerSeat cardCount={topPlayer.cardCount ?? undefined} isActive={view.currentSeat === topPlayer.seat} isTeammate name={topPlayer.nickname} position="top" status={topPlayer.connected ? '与你同队' : '等待重连'} />
        <PlayerSeat cardCount={leftPlayer.cardCount ?? undefined} isActive={view.currentSeat === leftPlayer.seat} name={leftPlayer.nickname} position="left" status={leftPlayer.connected ? '牌局进行中' : '等待重连'} />
        <PlayerSeat cardCount={rightPlayer.cardCount ?? undefined} isActive={view.currentSeat === rightPlayer.seat} name={rightPlayer.nickname} position="right" status={rightPlayer.connected ? '牌局进行中' : '等待重连'} />

        <div className="table-center">
          <div className="round-state">
            <span>本轮牌面</span>
            <strong>{tableMessage}</strong>
          </div>
          <div className="played-cards">
            {playedCards.length > 0 ? playedCards.map((card, index) => (
              <div className="played-card" key={card.id} style={{ transform: `translateX(${index * 34}px) rotate(${(index - 1) * 2}deg)` }}>
                <PokerCard card={card} index={index} onToggle={() => undefined} selected={false} />
              </div>
            )) : (
              <div className="table-seal" aria-hidden="true"><span>贯</span><small>以牌会友</small></div>
            )}
          </div>
        </div>

        <section className="self-area">
          {speech !== null ? <div className="speech-bubble">{speech}</div> : null}
          <div className="self-status">
            <div className="self-avatar">{selfPlayer.nickname.slice(0, 1)}</div>
            <div><strong>{selfPlayer.nickname}</strong><span>{selfPlayer.isHost ? '本家 · 房主' : '本家'}</span></div>
            <span className="hand-count">{hand.length} 张</span>
          </div>

          <div className="action-bar">
            <button className="button button-secondary action-small" disabled={!isSelfTurn || view.lastPlay === null} onClick={() => { setSelectedIds([]); onPass(); }} type="button">不要</button>
            <button className="button button-secondary action-small" onClick={() => setLocalMessage('提示：优先选择能合法压过牌面的较小组合')} type="button">提示</button>
            <button className="button button-primary play-button" disabled={!isSelfTurn || selectedIds.length === 0} onClick={handlePlay} type="button">
              出牌{selectedIds.length > 0 ? ` · ${selectedIds.length} 张` : ''}
            </button>
            <button aria-label="整理手牌" className="round-action" onClick={() => setSelectedIds([])} type="button"><Icon name="sort" /></button>
            <button aria-label="快捷语和表情" className="round-action" onClick={() => setShowChat(true)} type="button"><Icon name="chat" /></button>
          </div>

          <div className="hand-rack" aria-label={`你的手牌，共 ${hand.length} 张`}>
            {hand.map((card, index) => (
              <PokerCard card={card} index={index} key={card.id} onToggle={toggleCard} selected={selectedIds.includes(card.id)} />
            ))}
          </div>
        </section>
      </div>

      {showChat ? <QuickChatDrawer onClose={() => setShowChat(false)} onSend={sendMessage} /> : null}
      {showWildcard ? (
        <WildcardModal
          onCancel={() => setShowWildcard(false)}
          onConfirm={commitPlay}
          options={wildcardOptions}
        />
      ) : null}
    </main>
  );
}
