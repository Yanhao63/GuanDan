import { useState } from 'react';
import { Icon } from '../ui/Icon';

interface TopHudProps {
  level: string;
  roomCode: string;
  timerLabel: string;
}

interface AudioState {
  bgm: number;
  effects: number;
  voice: number;
}

export function TopHud({ level, roomCode, timerLabel }: TopHudProps) {
  const [showAudio, setShowAudio] = useState(false);
  const [audio, setAudio] = useState<AudioState>({ bgm: 35, effects: 70, voice: 65 });

  const setVolume = (key: keyof AudioState, value: number) => {
    setAudio((current) => ({ ...current, [key]: value }));
  };

  return (
    <header className="top-hud">
      <div className="hud-brand">掼蛋蛋</div>
      <div className="hud-divider" />
      <div className="hud-stat"><span>房间</span><strong>{roomCode}</strong></div>
      <div className="hud-stat hud-level"><span>当前级牌</span><strong>{level}</strong></div>
      <div className="hud-team-score">
        <div><span>我方</span><strong>2</strong><small>打 A 失败 0/3</small></div>
        <i />
        <div><span>对方</span><strong>2</strong><small>本副等待首出</small></div>
      </div>
      <div className="hud-spacer" />
      <div className="direction-chip"><Icon name="rotate" size={18} /> 逆时针</div>
      <div className="timer-chip">{timerLabel}</div>
      <button aria-expanded={showAudio} aria-label="声音设置" className="hud-icon-button" onClick={() => setShowAudio((open) => !open)} type="button">
        <Icon name="audio" />
      </button>
      <button aria-label="牌局设置" className="hud-icon-button" type="button"><Icon name="gear" /></button>

      {showAudio ? (
        <section className="audio-popover" aria-label="声音设置">
          <strong>声音设置</strong>
          <label>背景音乐 <input max="100" min="0" onChange={(event) => setVolume('bgm', Number(event.target.value))} type="range" value={audio.bgm} /></label>
          <label>出牌音效 <input max="100" min="0" onChange={(event) => setVolume('effects', Number(event.target.value))} type="range" value={audio.effects} /></label>
          <label>女声播报 <input max="100" min="0" onChange={(event) => setVolume('voice', Number(event.target.value))} type="range" value={audio.voice} /></label>
        </section>
      ) : null}
    </header>
  );
}
