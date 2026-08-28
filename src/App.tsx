import { useState } from 'react';
import { EntryScreen } from './components/EntryScreen';
import { GameTable } from './components/GameTable';
import { LobbyScreen } from './components/LobbyScreen';
import type { RoomPlayer, TimerChoice } from './game/types';

type Screen = 'entry' | 'lobby' | 'game';

const makeHost = (nickname: string): RoomPlayer => ({
  id: 'local-player',
  nickname,
  kind: 'human',
  isHost: true,
  isReady: true,
  seat: 0,
});

const botNames = ['临江机器人', '松风机器人', '竹影机器人'];

export function App() {
  const [screen, setScreen] = useState<Screen>('entry');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('482731');
  const [timer, setTimer] = useState<TimerChoice>('不限时');
  const [players, setPlayers] = useState<Array<RoomPlayer | null>>([null, null, null, null]);

  const enterLobby = (nextNickname: string, nextRoomCode: string) => {
    setNickname(nextNickname);
    setRoomCode(nextRoomCode);
    setPlayers([makeHost(nextNickname), null, null, null]);
    setScreen('lobby');
  };

  const addBot = (seat: 0 | 1 | 2 | 3) => {
    setPlayers((current) => current.map((player, index) => {
      if (index !== seat || player !== null) {
        return player;
      }
      return {
        id: `bot-${seat}`,
        nickname: botNames[Math.max(0, seat - 1)],
        kind: 'bot',
        isHost: false,
        isReady: true,
        seat,
      };
    }));
  };

  const removeBot = (seat: 0 | 1 | 2 | 3) => {
    setPlayers((current) => current.map((player, index) => index === seat && player?.kind === 'bot' ? null : player));
  };

  if (screen === 'entry') {
    return (
      <EntryScreen
        onCreateRoom={(nextNickname) => enterLobby(nextNickname, '482731')}
        onJoinRoom={enterLobby}
      />
    );
  }

  if (screen === 'lobby') {
    return (
      <LobbyScreen
        nickname={nickname}
        onAddBot={addBot}
        onRemoveBot={removeBot}
        onStart={() => setScreen('game')}
        onTimerChange={setTimer}
        players={players}
        roomCode={roomCode}
        timer={timer}
      />
    );
  }

  return <GameTable nickname={nickname} roomCode={roomCode} timer={timer} />;
}
