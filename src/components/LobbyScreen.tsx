import type { RoomPlayer, TimerChoice } from '../game/types';
import { Icon } from '../ui/Icon';
import { BrandMark } from './BrandMark';

interface LobbyScreenProps {
  nickname: string;
  players: Array<RoomPlayer | null>;
  reconnectCode: string;
  roomCode: string;
  timer: TimerChoice;
  onAddBot: (seat: 0 | 1 | 2 | 3) => void;
  onRemoveBot: (seat: 0 | 1 | 2 | 3) => void;
  onStart: () => void;
  onTimerChange: (timer: TimerChoice) => void;
}

const seatNames = ['本家', '下家', '对家 · 队友', '上家'] as const;
const timers: TimerChoice[] = ['不限时', '30秒', '60秒', '90秒'];

export function LobbyScreen({
  nickname,
  players,
  reconnectCode,
  roomCode,
  timer,
  onAddBot,
  onRemoveBot,
  onStart,
  onTimerChange,
}: LobbyScreenProps) {
  const isFull = players.every((player) => player !== null);

  const copyInvitation = async () => {
    await navigator.clipboard?.writeText(`来玩掼蛋蛋，房间号：${roomCode}`);
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
          {players.map((player, index) => (
            <article className={player === null ? 'lobby-seat lobby-seat-empty' : 'lobby-seat'} key={seatNames[index]}>
              <div className="seat-number">{index + 1}</div>
              <div className="lobby-avatar" aria-hidden="true">
                {player === null ? <Icon name="plus" size={28} /> : player.nickname.slice(0, 1)}
              </div>
              <div className="lobby-seat-copy">
                <span>{seatNames[index]}</span>
                <strong>{player?.nickname ?? '空座位'}</strong>
                <small>{player === null ? '等待玩家' : player.isHost ? '房主 · 已准备' : player.kind === 'bot' ? '机器人 · 已准备' : '已准备'}</small>
              </div>
              {player === null ? (
                <button className="button button-compact" onClick={() => onAddBot(index as 0 | 1 | 2 | 3)} type="button">
                  <Icon name="plus" size={17} /> 加入机器人
                </button>
              ) : player.kind === 'bot' ? (
                <button className="text-button" onClick={() => onRemoveBot(index as 0 | 1 | 2 | 3)} type="button">移除</button>
              ) : (
                <span className="ready-mark"><Icon name="check" size={18} /> 已就绪</span>
              )}
            </article>
          ))}
        </div>

        <aside className="room-settings">
          <div>
            <span className="setting-label">出牌倒计时</span>
            <div className="segmented-control" aria-label="出牌倒计时">
              {timers.map((choice) => (
                <button
                  aria-pressed={timer === choice}
                  className={timer === choice ? 'segment segment-active' : 'segment'}
                  key={choice}
                  onClick={() => onTimerChange(choice)}
                  type="button"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
          <button className="button button-secondary arrange-button" type="button">
            <Icon name="shuffle" size={20} /> 调整座位
          </button>
        </aside>

        <div className="reconnect-safety">
          <div><strong>我的专用重连码</strong><span>请只保存自己的重连码；掉线后可回到原座位。</span></div>
          <code>{reconnectCode}</code>
          <button className="button button-compact" onClick={copyReconnectCode} type="button"><Icon name="copy" size={16} /> 复制</button>
        </div>

        <div className="lobby-actions">
          <span>{isFull ? '四位玩家已就绪' : `还差 ${players.filter((player) => player === null).length} 位玩家`}</span>
          <button className="button button-primary start-button" disabled={!isFull} onClick={onStart} type="button">
            开始牌局
          </button>
        </div>
      </section>
    </main>
  );
}
