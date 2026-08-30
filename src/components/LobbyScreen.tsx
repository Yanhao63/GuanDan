import { useState } from 'react';
import type { RoomPlayer, TimerChoice } from '../game/types';
import type { Seat } from '../game/rules/match';
import { Icon } from '../ui/Icon';
import { BrandMark } from './BrandMark';

interface LobbyScreenProps {
  nickname: string;
  players: Array<RoomPlayer | null>;
  reconnectCode: string;
  roomCode: string;
  selfSeat: Seat;
  timer: TimerChoice;
  onAddBot: (seat: Seat) => void;
  onRemoveBot: (seat: Seat) => void;
  onStart: () => void;
  onSwapSeats: (firstSeat: Seat, secondSeat: Seat) => void;
  onTimerChange: (timer: TimerChoice) => void;
}

const seatNames = ['本家', '下家', '对家 · 队友', '上家'] as const;
const timers: TimerChoice[] = ['不限时', '30秒', '60秒', '90秒'];

export function LobbyScreen({
  nickname,
  players,
  reconnectCode,
  roomCode,
  selfSeat,
  timer,
  onAddBot,
  onRemoveBot,
  onStart,
  onSwapSeats,
  onTimerChange,
}: LobbyScreenProps) {
  const [arranging, setArranging] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const isFull = players.every((player) => player !== null);
  const isHost = players[selfSeat]?.isHost === true;
  const occupiedCount = players.filter((player) => player !== null).length;

  const toggleArrangement = () => {
    setArranging((current) => !current);
    setSelectedSeat(null);
  };

  const selectSeat = (seat: Seat) => {
    if (players[seat] === null) {
      return;
    }
    if (selectedSeat === null) {
      setSelectedSeat(seat);
      return;
    }
    if (selectedSeat === seat) {
      setSelectedSeat(null);
      return;
    }
    onSwapSeats(selectedSeat, seat);
    setSelectedSeat(null);
  };

  const copyInvitation = async () => {
    await navigator.clipboard?.writeText(`来玩阿钊掼蛋，房间号：${roomCode}`);
  };

  const copyReconnectCode = async () => {
    await navigator.clipboard?.writeText(reconnectCode);
  };

  return (
    <main className="lobby-screen">
      <header className="lobby-header">
        <BrandMark />
        <div className="room-chip">
          <span>房间号</span>
          <strong>{roomCode}</strong>
          <button aria-label="复制邀请信息" className="icon-button" onClick={copyInvitation} type="button">
            <Icon name="copy" size={20} />
          </button>
        </div>
      </header>

      <section className="lobby-content">
        <div className="lobby-title">
          <p className="eyebrow">等待朋友入座</p>
          <h1>{nickname} 的牌桌</h1>
          <p>对面的玩家是你的队友，房主可以在开始前安排座位。</p>
        </div>

        <div className="seat-grid">
          {players.map((player, index) => {
            const seat = index as Seat;
            const selected = arranging && selectedSeat === seat;
            const className = [
              'lobby-seat',
              player === null ? 'lobby-seat-empty' : '',
              arranging && player !== null ? 'lobby-seat-arrangeable' : '',
              selected ? 'lobby-seat-selected' : '',
            ].filter(Boolean).join(' ');
            return (
            <article className={className} key={seatNames[index]}>
              <div className="seat-number">{index + 1}</div>
              <div className="lobby-avatar" aria-hidden="true">
                {player === null ? <Icon name="plus" size={28} /> : player.nickname.slice(0, 1)}
              </div>
              <div className="lobby-seat-copy">
                <span>{seatNames[index]}</span>
                <strong>{player?.nickname ?? '空座位'}</strong>
                <small>{player === null ? '等待玩家' : player.isHost ? '房主 · 已准备' : player.kind === 'bot' ? '机器人 · 已准备' : '已准备'}</small>
              </div>
              {arranging && player !== null ? (
                <button
                  aria-pressed={selected}
                  className={selected ? 'button button-compact seat-pick-button seat-pick-button-selected' : 'button button-compact seat-pick-button'}
                  onClick={() => selectSeat(seat)}
                  type="button"
                >
                  {selected ? <><Icon name="check" size={17} /> 已选择</> : '选择'}
                </button>
              ) : player === null && isHost ? (
                <button className="button button-compact" onClick={() => onAddBot(seat)} type="button">
                  <Icon name="plus" size={17} /> 加入机器人
                </button>
              ) : player?.kind === 'bot' && isHost ? (
                <button className="text-button" onClick={() => onRemoveBot(seat)} type="button">移除</button>
              ) : player !== null ? (
                <span className="ready-mark"><Icon name="check" size={18} /> 已就绪</span>
              ) : <span className="waiting-mark">等待加入</span>}
            </article>
          )})}
        </div>

        {arranging && (
          <div className="arrange-hint" role="status">
            <Icon name="shuffle" size={18} />
            {selectedSeat === null ? '请选择第一名玩家' : `已选择 ${players[selectedSeat]?.nickname ?? ''}，再选择一名玩家即可交换`}
          </div>
        )}

        <aside className="room-settings">
          <div>
            <span className="setting-label">出牌倒计时</span>
            <div className="segmented-control" aria-label="出牌倒计时">
              {timers.map((choice) => (
                <button
                  aria-pressed={timer === choice}
                  className={timer === choice ? 'segment segment-active' : 'segment'}
                  disabled={!isHost}
                  key={choice}
                  onClick={() => onTimerChange(choice)}
                  type="button"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
          <button
            aria-pressed={arranging}
            className="button button-secondary arrange-button"
            disabled={!isHost || occupiedCount < 2}
            onClick={toggleArrangement}
            type="button"
          >
            <Icon name={arranging ? 'check' : 'shuffle'} size={20} /> {arranging ? '完成调整' : '调整座位'}
          </button>
        </aside>

        <div className="reconnect-safety">
          <div><strong>我的专用重连码</strong><span>请只保存自己的重连码；掉线后可回到原座位。</span></div>
          <code>{reconnectCode}</code>
          <button className="button button-compact" onClick={copyReconnectCode} type="button"><Icon name="copy" size={16} /> 复制</button>
        </div>

        <div className="lobby-actions">
          <span>{isHost ? (isFull ? '四位玩家已就绪' : `还差 ${players.filter((player) => player === null).length} 位玩家`) : '等待房主安排座位并开局'}</span>
          <button className="button button-primary start-button" disabled={!isFull || !isHost} onClick={onStart} type="button">
            开始牌局
          </button>
        </div>
      </section>
    </main>
  );
}
