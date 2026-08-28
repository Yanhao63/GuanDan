import { useMemo, useState } from 'react';
import { demoHand, sortDemoHand } from '../game/demoCards';
import type { CardData, TimerChoice } from '../game/types';
import { Icon } from '../ui/Icon';
import { PlayerSeat } from './PlayerSeat';
import { PokerCard } from './PokerCard';
import { QuickChatDrawer } from './QuickChatDrawer';
import { TopHud } from './TopHud';
import { WildcardModal } from './WildcardModal';

interface GameTableProps {
  nickname: string;
  roomCode: string;
  timer: TimerChoice;
}

export function GameTable({ nickname, roomCode, timer }: GameTableProps) {
  const [hand, setHand] = useState<CardData[]>(() => sortDemoHand(demoHand, '2'));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showWildcard, setShowWildcard] = useState(false);
  const [tableMessage, setTableMessage] = useState('等待上家出牌');
  const [speech, setSpeech] = useState<string | null>(null);
  const [playedCards, setPlayedCards] = useState<CardData[]>([]);

  const selectedCards = useMemo(
    () => hand.filter((card) => selectedIds.includes(card.id)),
    [hand, selectedIds],
  );

  const toggleCard = (cardId: string) => {
    setSelectedIds((current) => current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]);
  };

  const commitPlay = (wildcardChoice?: string) => {
    setPlayedCards(selectedCards);
    setHand((current) => current.filter((card) => !selectedIds.includes(card.id)));
    setSelectedIds([]);
    setShowWildcard(false);
    setTableMessage(wildcardChoice === undefined ? '已出牌 · 等待下家' : `已按“${wildcardChoice}”出牌`);
  };

  const handlePlay = () => {
    const wildCards = selectedCards.filter((card) => card.rank === '2' && card.suit === 'hearts');
    const hasStraightFlushCore = ['10', 'J', 'Q'].every((rank) =>
      selectedCards.some((card) => card.rank === rank && card.suit === 'spades'),
    );
    const isWildcardDemo = selectedCards.length === 5 && wildCards.length === 2 && hasStraightFlushCore;

    if (isWildcardDemo) {
      setShowWildcard(true);
      return;
    }
    if (wildCards.length > 0) {
      setTableMessage('百搭演示：请选择两张红桃 2 与黑桃 10、J、Q');
      return;
    }
    commitPlay();
  };

  const sendMessage = (message: string) => {
    setSpeech(message);
    setShowChat(false);
  };

  return (
    <main className="game-screen">
      <TopHud roomCode={roomCode} timerLabel={timer} />

      <div className="table-canvas">
        <PlayerSeat isTeammate name="松风机器人" position="top" status="与你同队" />
        <PlayerSeat cardCount={9} name="竹影机器人" position="left" status="剩余牌已公开" />
        <PlayerSeat isActive name="临江机器人" position="right" status="正在思考" />

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
            <div className="self-avatar">{nickname.slice(0, 1)}</div>
            <div><strong>{nickname}</strong><span>本家 · 房主</span></div>
            <span className="hand-count">{hand.length} 张</span>
          </div>

          <div className="action-bar">
            <button className="button button-secondary action-small" onClick={() => setSelectedIds([])} type="button">不要</button>
            <button className="button button-secondary action-small" onClick={() => setTableMessage('提示：可尝试从较小的单张开始')} type="button">提示</button>
            <button className="button button-primary play-button" disabled={selectedIds.length === 0} onClick={handlePlay} type="button">
              出牌{selectedIds.length > 0 ? ` · ${selectedIds.length} 张` : ''}
            </button>
            <button aria-label="整理手牌" className="round-action" onClick={() => setHand((current) => sortDemoHand(current, '2'))} type="button"><Icon name="sort" /></button>
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
      {showWildcard ? <WildcardModal onCancel={() => setShowWildcard(false)} onConfirm={commitPlay} /> : null}
    </main>
  );
}
