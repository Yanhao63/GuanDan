import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { gameAudio, loadAudioSettings, type AudioSettings } from '../audio/gameAudio';
import { describePlayForSpeech } from '../audio/playAnnouncement';
import { sortDemoHand } from '../game/demoCards';
import { classifyPlay } from '../game/rules/classify';
import { applyHandOrder, moveCardAtTarget, type CardDropPlacement } from '../game/handOrder';
import {
  createPointerDrag,
  updatePointerDrag,
  type PointerDragState,
} from '../game/pointerGesture';
import type { NetworkPlayEvent, NetworkQuickMessage } from '../game/network';
import type { RoomPlayerView, RoomView, TributeAction } from '../game/room';
import type { Seat } from '../game/rules/match';
import type { PlayInterpretation } from '../game/rules/types';
import { Icon } from '../ui/Icon';
import { DealResultOverlay } from './DealResultOverlay';
import { PlayerSeat } from './PlayerSeat';
import { PlayHistoryDrawer } from './PlayHistoryDrawer';
import { PokerCard } from './PokerCard';
import { QuickChatDrawer } from './QuickChatDrawer';
import { DirectionalPlay, getTableDirection, TablePlayOwner, TurnIndicator } from './TableActivity';
import { TopHud } from './TopHud';
import { TributeOverlay } from './TributeOverlay';
import { TurnProgressBar } from './TurnProgressBar';
import { WildcardModal } from './WildcardModal';

interface GameTableProps {
  activePlayEvent: NetworkPlayEvent | null;
  activeQuickMessage: NetworkQuickMessage | null;
  notice?: string;
  onPass: () => void;
  onPlay: (cardIds: string[], description: string) => void;
  onPlayAnimationComplete: () => void;
  onQuickMessage: (message: string) => void;
  onQuickMessageComplete: () => void;
  onNextDeal: () => void;
  onTributeAction: (action: Exclude<TributeAction, 'waiting'>, cardId: string) => void;
  reconnectCode: string;
  view: RoomView;
}

interface QuickMessageBubbleProps {
  event: NetworkQuickMessage;
  nickname: string;
  onComplete: () => void;
  selfSeat: Seat;
}

function QuickMessageBubble({ event, nickname, onComplete, selfSeat }: QuickMessageBubbleProps) {
  const direction = getTableDirection(selfSeat, event.player);

  useEffect(() => {
    const timeout = window.setTimeout(onComplete, 4_000);
    return () => window.clearTimeout(timeout);
  }, [event.id, onComplete]);

  return (
    <div aria-live="polite" className={`speech-bubble speech-bubble-${direction}`} role="status">
      <strong>{nickname}</strong>
      <span>{event.message}</span>
    </div>
  );
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

export function GameTable({
  activePlayEvent,
  activeQuickMessage,
  notice = '',
  onNextDeal,
  onPass,
  onPlay,
  onPlayAnimationComplete,
  onQuickMessage,
  onQuickMessageComplete,
  onTributeAction,
  reconnectCode,
  view,
}: GameTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [handOrder, setHandOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPlacement, setDragPlacement] = useState<CardDropPlacement>('before');
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const suppressToggleRef = useRef(false);
  const [audio, setAudio] = useState<AudioSettings>(loadAudioSettings);
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showWildcard, setShowWildcard] = useState(false);
  const [wildcardOptions, setWildcardOptions] = useState<PlayInterpretation[]>([]);
  const [localMessage, setLocalMessage] = useState('');

  const sortedHand = useMemo(() => sortDemoHand(view.hand, view.level), [view.hand, view.level]);
  const hand = useMemo(() => applyHandOrder(sortedHand, handOrder), [handOrder, sortedHand]);
  const topPlayer = playerAt(view, relativeSeat(view.selfSeat, 2));
  const leftPlayer = playerAt(view, relativeSeat(view.selfSeat, 3));
  const rightPlayer = playerAt(view, relativeSeat(view.selfSeat, 1));
  const selfPlayer = playerAt(view, view.selfSeat);
  const currentPlayer = view.currentSeat === null ? null : playerAt(view, view.currentSeat);
  const tablePlayOwner = view.lastPlay === null ? null : playerAt(view, view.lastPlay.player);
  const currentDirection = currentPlayer === null
    ? null
    : getTableDirection(view.selfSeat, currentPlayer.seat);
  const pausedPlayer = view.pause === null ? null : playerAt(view, view.pause.seat);
  const isSelfTurn = view.pause === null && view.currentSeat === view.selfSeat;
  const tableMessage = notice.length > 0
    ? notice
    : localMessage.length > 0
      ? localMessage
      : activePlayEvent?.description ?? view.lastPlay?.description ?? '等待首出';

  const selectedCards = useMemo(
    () => hand.filter((card) => selectedIds.includes(card.id)),
    [hand, selectedIds],
  );

  useEffect(() => {
    gameAudio.configure(audio);
  }, [audio]);

  useEffect(() => {
    if (activePlayEvent === null) {
      return;
    }
    gameAudio.playEffect('play');
    gameAudio.announce(describePlayForSpeech(activePlayEvent));
  }, [activePlayEvent?.id]);

  useEffect(() => {
    if (isSelfTurn) {
      gameAudio.playEffect('turn');
    }
  }, [isSelfTurn]);

  const changeAudio = (key: keyof AudioSettings, value: number) => {
    setAudio((current) => ({ ...current, [key]: value }));
  };

  const toggleCard = (cardId: string) => {
    if (suppressToggleRef.current) {
      suppressToggleRef.current = false;
      return;
    }
    setSelectedIds((current) => current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]);
  };

  const beginPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-card-id]');
    const cardId = card?.dataset.cardId;
    if (cardId === undefined) {
      return;
    }
    pointerDragRef.current = createPointerDrag(cardId, event.clientX, event.clientY);
  };

  const movePointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (drag === null) {
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-card-id]');
    const targetBounds = target?.getBoundingClientRect();
    const placement: CardDropPlacement | undefined = targetBounds === undefined
      ? undefined
      : event.clientX >= targetBounds.left + targetBounds.width / 2 ? 'after' : 'before';
    const update = updatePointerDrag(
      drag,
      event.clientX,
      event.clientY,
      target?.dataset.cardId,
      placement,
    );
    pointerDragRef.current = update.state;
    if (update.started) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setHandOrder(hand.map((card) => card.id));
      setDraggingId(update.state.cardId);
      setDragTargetId(update.state.targetId);
      setDragPlacement(update.state.placement);
    }
    if (!update.state.active) {
      return;
    }
    if (update.state.targetId !== drag.targetId || update.state.placement !== drag.placement) {
      setDragTargetId(update.state.targetId);
      setDragPlacement(update.state.placement);
    }
  };

  const finishPointerDrag = () => {
    const drag = pointerDragRef.current;
    if (drag?.active) {
      setHandOrder((current) => moveCardAtTarget(current, drag.cardId, drag.targetId, drag.placement));
      suppressToggleRef.current = true;
      window.setTimeout(() => {
        suppressToggleRef.current = false;
      }, 0);
    }
    pointerDragRef.current = null;
    setDraggingId(null);
    setDragTargetId(null);
    setDragPlacement('before');
  };

  const sortHand = () => {
    setHandOrder([]);
    setSelectedIds([]);
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
    const interpretations = classifyPlay(selectedCards, view.level);

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
    setShowChat(false);
    onQuickMessage(message);
  };

  return (
    <main className="game-screen" onPointerDown={() => { void gameAudio.unlock(); }}>
      <TopHud
        audio={audio}
        historyOpen={showHistory}
        level={view.level}
        progress={view.progress}
        reconnectCode={reconnectCode}
        roomCode={view.roomCode}
        selfSeat={view.selfSeat}
        timerLabel={view.timer}
        turnDeadline={view.turnDeadline}
        onAudioChange={changeAudio}
        onHistoryToggle={() => {
          setShowChat(false);
          setShowHistory((open) => !open);
        }}
      />

      <div className="table-canvas">
        {activeQuickMessage !== null ? (
          <QuickMessageBubble
            event={activeQuickMessage}
            nickname={playerAt(view, activeQuickMessage.player).nickname}
            onComplete={onQuickMessageComplete}
            selfSeat={view.selfSeat}
          />
        ) : null}
        <PlayerSeat cardCount={topPlayer.cardCount ?? undefined} isActive={view.pause === null && view.currentSeat === topPlayer.seat} isTeammate name={topPlayer.nickname} position="top" status={topPlayer.controlledByBot ? '机器人接管中' : topPlayer.connected ? '与你同队' : '等待重连'} />
        <PlayerSeat cardCount={leftPlayer.cardCount ?? undefined} isActive={view.pause === null && view.currentSeat === leftPlayer.seat} name={leftPlayer.nickname} position="left" status={leftPlayer.controlledByBot ? '机器人接管中' : leftPlayer.connected ? '牌局进行中' : '等待重连'} />
        <PlayerSeat cardCount={rightPlayer.cardCount ?? undefined} isActive={view.pause === null && view.currentSeat === rightPlayer.seat} name={rightPlayer.nickname} position="right" status={rightPlayer.controlledByBot ? '机器人接管中' : rightPlayer.connected ? '牌局进行中' : '等待重连'} />

        <div className="table-center">
          {currentPlayer !== null && currentDirection !== null ? (
            <TurnIndicator direction={currentDirection} nickname={currentPlayer.nickname} />
          ) : null}
          <div className="round-state">
            <span>本轮牌面</span>
            <div className="round-state-detail">
              <strong>{tableMessage}</strong>
              {tablePlayOwner === null ? null : <TablePlayOwner nickname={tablePlayOwner.nickname} />}
            </div>
          </div>
          <div className="played-cards">
            <DirectionalPlay
              activeEvent={activePlayEvent}
              fallbackPlay={view.lastPlay}
              level={view.level}
              onAnimationComplete={onPlayAnimationComplete}
              selfSeat={view.selfSeat}
            />
          </div>
        </div>

        <section aria-current={isSelfTurn ? 'true' : undefined} className={`self-area${isSelfTurn ? ' self-area-active' : ''}`}>
          <div className="self-status">
            <div className="self-avatar">{selfPlayer.nickname.slice(0, 1)}</div>
            <div><strong>{selfPlayer.nickname}</strong><span>{selfPlayer.isHost ? '本家 · 房主' : '本家'}</span></div>
            <span className="hand-count">{hand.length} 张</span>
            {isSelfTurn ? <span className="self-turn-tag">当前出牌</span> : null}
          </div>

          <TurnProgressBar timer={view.timer} turnDeadline={view.turnDeadline} />
          <div className="action-bar">
            <button className="button button-secondary action-small" disabled={!isSelfTurn || view.lastPlay === null} onClick={() => { setSelectedIds([]); onPass(); }} type="button">不要</button>
            <button className="button button-primary play-button" disabled={!isSelfTurn || selectedIds.length === 0} onClick={handlePlay} type="button">
              出牌{selectedIds.length > 0 ? ` · ${selectedIds.length} 张` : ''}
            </button>
            <button aria-label="整理手牌" className="round-action" onClick={sortHand} type="button"><Icon name="sort" /></button>
            <button aria-label="快捷语和表情" className="round-action" onClick={() => { setShowHistory(false); setShowChat(true); }} type="button"><Icon name="chat" /></button>
          </div>

          <div
            aria-label={`你的手牌，共 ${hand.length} 张`}
            className={`hand-rack${draggingId === null ? '' : ' hand-rack-dragging'}`}
            onPointerCancel={finishPointerDrag}
            onPointerDown={beginPointerDrag}
            onPointerMove={movePointerDrag}
            onPointerUp={finishPointerDrag}
          >
            {hand.map((card, index) => (
              <PokerCard
                card={card}
                dragging={draggingId === card.id}
                dragPlacement={dragPlacement}
                dragTarget={draggingId !== null && draggingId !== card.id && dragTargetId === card.id}
                index={index}
                key={card.id}
                level={view.level}
                onToggle={toggleCard}
                reorderable
                selected={selectedIds.includes(card.id)}
              />
            ))}
          </div>
        </section>

        {view.pause !== null && pausedPlayer !== null ? (
          <div className="pause-backdrop" role="status">
            <section className="pause-card">
              <span>牌局暂停</span>
              <h2>等待 {pausedPlayer.nickname} 重连</h2>
              <p>{view.pause.kind === 'host' ? '房主回来后牌局继续，进行中不会转移房主或启用机器人。' : '若 120 秒内仍未回来，将由机器人暂时接管；本人回来后可随时重新接手。'}</p>
            </section>
          </div>
        ) : null}

        {view.pause === null && view.tribute !== null ? (
          <TributeOverlay
            key={view.tribute.action}
            level={view.level}
            onAction={onTributeAction}
            tribute={view.tribute}
          />
        ) : null}

        {view.phase === 'complete' && view.settlement !== null ? (
          <DealResultOverlay
            finishOrder={view.finishOrder}
            isHost={selfPlayer.isHost}
            onNextDeal={onNextDeal}
            players={view.players}
            selfSeat={view.selfSeat}
            settlement={view.settlement}
          />
        ) : null}
      </div>

      {showChat ? <QuickChatDrawer onClose={() => setShowChat(false)} onSend={sendMessage} /> : null}
      {showHistory ? (
        <PlayHistoryDrawer
          history={view.history}
          onClose={() => setShowHistory(false)}
          players={view.players}
          selfSeat={view.selfSeat}
        />
      ) : null}
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
