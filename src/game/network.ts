import type { JoinReceipt, RoomView } from './room';
import type { Seat } from './rules/match';
import type { TimerChoice } from './types';

export type OutgoingMessage =
  | { seat: Seat; type: 'add-bot' }
  | { seat: Seat; type: 'remove-bot' }
  | { timer: TimerChoice; type: 'set-timer' }
  | { type: 'start' }
  | { type: 'start-next-deal' }
  | { cardIds: string[]; description?: string; type: 'play' }
  | { type: 'pass' }
  | { cardId: string; type: 'pay-tribute' }
  | { cardId: string; type: 'choose-double-tribute' }
  | { cardId: string; type: 'return-tribute' }
  | { message: string; type: 'quick-message' };

interface ConnectionHandlers {
  onError: (message: string) => void;
  onJoined: (receipt: JoinReceipt, view: RoomView) => void;
  onState: (view: RoomView) => void;
}

interface ConnectOptions extends ConnectionHandlers {
  nickname?: string;
  reconnect?: string;
  roomCode: string;
}

interface ServerMessage {
  message?: string;
  receipt?: JoinReceipt;
  type: 'error' | 'joined' | 'quick-message' | 'state';
  view?: RoomView;
}

export class LiveRoomConnection {
  constructor(private readonly socket: WebSocket) {}

  send(message: OutgoingMessage): void {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('实时连接尚未就绪');
    }
    this.socket.send(JSON.stringify(message));
  }

  close(): void {
    this.socket.close(1000, '离开牌桌');
  }
}

function websocketUrl(options: ConnectOptions): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(`${protocol}//${window.location.host}/api/rooms/${options.roomCode}/socket`);
  if (options.reconnect !== undefined) {
    url.searchParams.set('reconnect', options.reconnect);
  } else {
    url.searchParams.set('nickname', options.nickname ?? '');
  }
  return url.toString();
}

export async function createRoom(): Promise<string> {
  const response = await fetch('/api/rooms', { method: 'POST' });
  const payload = await response.json() as { error?: string; roomCode?: string };
  if (!response.ok || payload.roomCode === undefined) {
    throw new Error(payload.error ?? '无法创建房间');
  }
  return payload.roomCode;
}

export function connectRoom(options: ConnectOptions): Promise<LiveRoomConnection> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(websocketUrl(options));
    const connection = new LiveRoomConnection(socket);
    let joined = false;

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (message.type === 'joined' && message.receipt !== undefined && message.view !== undefined) {
        joined = true;
        options.onJoined(message.receipt, message.view);
        resolve(connection);
        return;
      }
      if (message.type === 'state' && message.view !== undefined) {
        options.onState(message.view);
        return;
      }
      if (message.type === 'error') {
        options.onError(message.message ?? '服务器拒绝了该操作');
      }
    });

    socket.addEventListener('error', () => {
      const error = new Error('无法连接到房间服务');
      if (!joined) {
        reject(error);
      }
      options.onError(error.message);
    });

    socket.addEventListener('close', (event) => {
      if (!joined) {
        reject(new Error('房间不存在、昵称重复或连接已被拒绝'));
      } else if (event.code !== 1000) {
        options.onError('与牌桌的连接已断开，正在等待重连');
      }
    });
  });
}
