import { useState } from 'react';
import { BrandMark } from './BrandMark';

interface EntryScreenProps {
  busy?: boolean;
  errorMessage?: string;
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (nickname: string, roomCode: string) => void;
}

export function EntryScreen({ busy = false, errorMessage = '', onCreateRoom, onJoinRoom }: EntryScreenProps) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [message, setMessage] = useState('');

  const normalizedNickname = nickname.trim();

  const handleCreate = () => {
    if (normalizedNickname.length < 2) {
      setMessage('请输入 2—10 个字的昵称');
      return;
    }
    onCreateRoom(normalizedNickname);
  };

  const handleJoin = () => {
    if (normalizedNickname.length < 2) {
      setMessage('请输入 2—10 个字的昵称');
      return;
    }
    if (!/^\d{6}$/.test(roomCode)) {
      setMessage('请输入 6 位房间号');
      return;
    }
    onJoinRoom(normalizedNickname, roomCode);
  };

  return (
    <main className="entry-screen">
      <div className="entry-ornament entry-ornament-left" aria-hidden="true" />
      <div className="entry-ornament entry-ornament-right" aria-hidden="true" />
      <section className="entry-panel" aria-labelledby="entry-title">
        <BrandMark />
        <div className="entry-copy">
          <p className="eyebrow">朋友局 · 无需注册</p>
          <h1 id="entry-title">今晚，坐一桌</h1>
          <p>输入昵称即可创建牌桌，或凭朋友发来的房间号入座。</p>
        </div>

        <label className="field-label" htmlFor="nickname">你的昵称</label>
        <input
          autoComplete="nickname"
          className="text-field"
          id="nickname"
          maxLength={10}
          onChange={(event) => {
            setNickname(event.target.value);
            setMessage('');
          }}
          placeholder="例如：听雨"
          value={nickname}
        />

        <button className="button button-primary button-wide" disabled={busy} onClick={handleCreate} type="button">
          {busy ? '正在连接…' : '创建房间'}
        </button>

        <div className="entry-divider"><span>或加入朋友的牌桌</span></div>

        <div className="join-row">
          <input
            aria-label="六位房间号"
            className="text-field room-code-field"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => {
              setRoomCode(event.target.value.replace(/\D/g, ''));
              setMessage('');
            }}
            placeholder="6 位房间号"
            value={roomCode}
          />
          <button className="button button-secondary" disabled={busy} onClick={handleJoin} type="button">加入房间</button>
        </div>

        <p aria-live="polite" className={message.length > 0 || errorMessage.length > 0 ? 'form-message form-message-visible' : 'form-message'}>
          {message.length > 0 ? message : errorMessage.length > 0 ? errorMessage : '无需账号，浏览器会安全保存你的重连信息'}
        </p>
      </section>
    </main>
  );
}
