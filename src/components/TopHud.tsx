import { useEffect, useState } from 'react';
import type { AudioSettings } from '../audio/gameAudio';
import { getTeamForSeat, type MatchProgress, type Seat } from '../game/rules/match';
import { Icon } from '../ui/Icon';

interface TopHudProps {
  audio: AudioSettings;
  level: string;
  historyOpen: boolean;
  progress: MatchProgress;
  reconnectCode: string;
  roomCode: string;
  selfSeat: Seat;
  timerLabel: string;
  turnDeadline: number | null;
  onAudioChange: (key: keyof AudioSettings, value: number) => void;
  onHistoryToggle: () => void;
}

export function TopHud({
  audio,
  historyOpen,
  level,
  progress,
  reconnectCode,
  roomCode,
  selfSeat,
  timerLabel,
  turnDeadline,
  onAudioChange,
  onHistoryToggle,
}: TopHudProps) {
  const [showAudio, setShowAudio] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const selfTeam = getTeamForSeat(selfSeat);
  const opponentTeam = selfTeam === 'team-a' ? 'team-b' : 'team-a';
  const selfProgress = progress[selfTeam];
  const opponentProgress = progress[opponentTeam];
  const remainingSeconds = turnDeadline === null
    ? null
    : Math.max(0, Math.ceil((turnDeadline - now) / 1_000));

  useEffect(() => {
    if (turnDeadline === null) {
      return undefined;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [turnDeadline]);

  const copyReconnectCode = async () => {
    await navigator.clipboard?.writeText(reconnectCode);
  };

  return (
    <header className="top-hud">
      <div className="hud-brand">掼蛋蛋</div>
      <div className="hud-divider" />
      <div className="hud-stat"><span>房间</span><strong>{roomCode}</strong></div>
      <div className="hud-stat hud-level"><span>当前级牌</span><strong>{level}</strong></div>
      <div className="hud-team-score">
        <div><span>我方</span><strong>{selfProgress.level}</strong><small>打 A 失败 {selfProgress.aFailures}/3</small></div>
        <i />
        <div><span>对方</span><strong>{opponentProgress.level}</strong><small>打 A 失败 {opponentProgress.aFailures}/3</small></div>
      </div>
      <div className="hud-spacer" />
      <div className="direction-chip"><Icon name="rotate" size={18} /> 逆时针</div>
      <div aria-live="polite" className="timer-chip">
        {remainingSeconds === null ? timerLabel : `剩余 ${remainingSeconds} 秒`}
      </div>
      <button aria-expanded={historyOpen} aria-label="查看出牌历史" className="hud-icon-button" onClick={onHistoryToggle} type="button">
        <Icon name="history" />
      </button>
      <button aria-expanded={showAudio} aria-label="声音设置" className="hud-icon-button" onClick={() => setShowAudio((open) => !open)} type="button">
        <Icon name="audio" />
      </button>
      <button aria-expanded={showRoomSettings} aria-label="牌局设置" className="hud-icon-button" onClick={() => setShowRoomSettings((open) => !open)} type="button"><Icon name="gear" /></button>

      {showAudio ? (
        <section className="audio-popover" aria-label="声音设置">
          <strong>声音设置</strong>
          <label>背景音乐 <input aria-label="背景音乐音量" max="100" min="0" onChange={(event) => onAudioChange('bgm', Number(event.target.value))} type="range" value={audio.bgm} /></label>
          <label>出牌音效 <input aria-label="出牌音效音量" max="100" min="0" onChange={(event) => onAudioChange('effects', Number(event.target.value))} type="range" value={audio.effects} /></label>
          <label>女声播报 <input aria-label="女声播报音量" max="100" min="0" onChange={(event) => onAudioChange('voice', Number(event.target.value))} type="range" value={audio.voice} /></label>
          <small>首次点击牌桌后启用声音</small>
        </section>
      ) : null}
      {showRoomSettings ? (
        <section className="room-popover" aria-label="牌局设置">
          <strong>掉线重连</strong>
          <p>保存这段专用重连码，可以回到当前座位。</p>
          <code>{reconnectCode}</code>
          <button className="button button-compact" onClick={copyReconnectCode} type="button"><Icon name="copy" size={16} /> 复制重连码</button>
        </section>
      ) : null}
    </header>
  );
}
