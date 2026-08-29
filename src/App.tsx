import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EntryScreen } from './components/EntryScreen';
import { GameTable } from './components/GameTable';
import { LobbyScreen } from './components/LobbyScreen';
import {
  connectRoom,
  createRoom,
  type LiveRoomConnection,
  type NetworkPlayEvent,
  type NetworkQuickMessage,
  type OutgoingMessage,
} from './game/network';
import type { JoinReceipt, RoomView } from './game/room';
import type { Seat } from './game/rules/match';
import type { RoomPlayer, TimerChoice } from './game/types';

function reconnectStorageKey(roomCode: string): string {
  return `guandan-reconnect:${roomCode}`;
}

function getSavedReconnectCode(roomCode: string, nickname: string): string | undefined {
  const saved = localStorage.getItem(reconnectStorageKey(roomCode));
  if (saved === null) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(saved) as { nickname?: string; reconnectCode?: string };
    return parsed.nickname === nickname ? parsed.reconnectCode : undefined;
  } catch {
    localStorage.removeItem(reconnectStorageKey(roomCode));
    return undefined;
  }
}

export function App() {
  const connectionRef = useRef<LiveRoomConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [playEvents, setPlayEvents] = useState<NetworkPlayEvent[]>([]);
  const [quickMessages, setQuickMessages] = useState<NetworkQuickMessage[]>([]);
  const [reconnectCode, setReconnectCode] = useState('');
  const [view, setView] = useState<RoomView | null>(null);

  useEffect(() => () => connectionRef.current?.close(), []);

  const players = useMemo<Array<RoomPlayer | null>>(() => {
    if (view === null) {
      return [null, null, null, null];
    }
    return ([0, 1, 2, 3] as Seat[]).map((seat) => {
      const player = view.players.find((candidate) => candidate.seat === seat);
      return player === undefined ? null : {
        id: `${player.kind}-${seat}`,
        isHost: player.isHost,
        isReady: true,
        kind: player.kind,
        nickname: player.nickname,
        seat,
      };
    });
  }, [view]);

  const openConnection = async (nickname: string, roomCode: string, reconnect?: string) => {
    setBusy(true);
    setMessage('');
    setPlayEvents([]);
    setQuickMessages([]);
    connectionRef.current?.close();
    try {
      const connection = await connectRoom({
        nickname,
        onError: setMessage,
        onJoined: (receipt: JoinReceipt, initialView: RoomView) => {
          const resolvedNickname = initialView.players.find(
            (player) => player.seat === initialView.selfSeat,
          )?.nickname ?? nickname;
          localStorage.setItem(reconnectStorageKey(roomCode), JSON.stringify({
            nickname: resolvedNickname,
            reconnectCode: receipt.reconnectCode,
          }));
          setReconnectCode(receipt.reconnectCode);
          setView(initialView);
          setMessage('');
        },
        onPlayEvent: (event) => {
          setPlayEvents((current) => [...current, event].slice(-24));
        },
        onQuickMessage: (event) => {
          setQuickMessages((current) => [...current, event].slice(-12));
        },
        onState: (nextView) => {
          setView(nextView);
          setMessage('');
        },
        reconnect,
        roomCode,
      });
      connectionRef.current = connection;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法连接到牌桌');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRoom = (nickname: string) => {
    void (async () => {
      setBusy(true);
      setMessage('');
      try {
        const roomCode = await createRoom();
        await openConnection(nickname, roomCode);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '无法创建房间');
        setBusy(false);
      }
    })();
  };

  const handleJoinRoom = (nickname: string, roomCode: string) => {
    void openConnection(nickname, roomCode, getSavedReconnectCode(roomCode, nickname));
  };

  const handleReconnect = (roomCode: string, reconnectCode: string) => {
    void openConnection('', roomCode, reconnectCode);
  };

  const consumePlayEvent = useCallback(() => {
    setPlayEvents((current) => current.slice(1));
  }, []);

  const consumeQuickMessage = useCallback(() => {
    setQuickMessages((current) => current.slice(1));
  }, []);

  if (view === null) {
    return (
      <EntryScreen
        busy={busy}
        errorMessage={message}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onReconnect={handleReconnect}
      />
    );
  }

  const send = (payload: OutgoingMessage) => {
    try {
      connectionRef.current?.send(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作发送失败');
    }
  };

  if (view.phase === 'lobby') {
    const self = view.players.find((player) => player.seat === view.selfSeat);
    return (
      <LobbyScreen
        nickname={self?.nickname ?? '玩家'}
        onAddBot={(seat) => send({ seat, type: 'add-bot' })}
        onRemoveBot={(seat) => send({ seat, type: 'remove-bot' })}
        onSwapSeats={(firstSeat, secondSeat) => send({ firstSeat, secondSeat, type: 'swap-seats' })}
        onStart={() => send({ type: 'start' })}
        onTimerChange={(timer: TimerChoice) => send({ timer, type: 'set-timer' })}
        players={players}
        reconnectCode={reconnectCode}
        roomCode={view.roomCode}
        selfSeat={view.selfSeat}
        timer={view.timer}
      />
    );
  }

  return (
    <GameTable
      activePlayEvent={playEvents[0] ?? null}
      activeQuickMessage={quickMessages[0] ?? null}
      key={`${view.roomCode}-${view.dealNumber}`}
      notice={message}
      onNextDeal={() => send({ type: 'start-next-deal' })}
      onPass={() => send({ type: 'pass' })}
      onPlayAnimationComplete={consumePlayEvent}
      onPlay={(cardIds, description) => send({ cardIds, description, type: 'play' })}
      onQuickMessage={(quickMessage) => send({ message: quickMessage, type: 'quick-message' })}
      onQuickMessageComplete={consumeQuickMessage}
      onTributeAction={(action, cardId) => send({ cardId, type: action })}
      reconnectCode={reconnectCode}
      view={view}
    />
  );
}
