import { DurableObject } from 'cloudflare:workers';
import { RoomEngine, type JoinReceipt, type RoomSnapshot } from '../src/game/room';
import type { Seat } from '../src/game/rules/match';
import type { TimerChoice } from '../src/game/types';

interface Env {
  ASSETS: Fetcher;
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
}

interface ConnectionAttachment {
  sessionId: string;
}

type ClientMessage =
  | { seat: Seat; type: 'add-bot' }
  | { seat: Seat; type: 'remove-bot' }
  | { timer: TimerChoice; type: 'set-timer' }
  | { type: 'start' }
  | { cardIds: string[]; description?: string; type: 'play' }
  | { type: 'pass' }
  | { message: string; type: 'quick-message' };

function secureRandom(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 4_294_967_296;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
}

function parseMessage(message: string | ArrayBuffer): ClientMessage {
  if (typeof message !== 'string') {
    throw new Error('只接受 JSON 文本消息');
  }
  return JSON.parse(message) as ClientMessage;
}

function roomCodeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/rooms\/(\d{6})\/socket$/);
  return match?.[1] ?? null;
}

export class GameRoom extends DurableObject<Env> {
  private readonly ready: Promise<void>;
  private room: RoomEngine | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = this.ctx.blockConcurrencyWhile(async () => {
      const snapshot = await this.ctx.storage.get<RoomSnapshot>('room');
      if (snapshot !== undefined) {
        this.room = RoomEngine.restore(snapshot, secureRandom, () => crypto.randomUUID());
      }
    });
  }

  private async persist(): Promise<void> {
    if (this.room !== null) {
      await this.ctx.storage.put('room', this.room.toSnapshot());
    }
  }

  private sendView(ws: WebSocket): void {
    if (this.room === null) {
      return;
    }
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (attachment === null) {
      return;
    }
    try {
      ws.send(JSON.stringify({ type: 'state', view: this.room.getView(attachment.sessionId) }));
    } catch {
      // The connection may have closed between enumeration and send.
    }
  }

  private broadcastViews(): void {
    this.ctx.getWebSockets().forEach((ws) => this.sendView(ws));
  }

  private runBotsUntilHuman(): void {
    if (this.room === null) {
      return;
    }
    let turns = 0;
    while (this.room.runCurrentBotTurn()) {
      turns += 1;
      if (turns >= 200) {
        throw new Error('机器人连续回合超过安全上限');
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname.endsWith('/initialize')) {
      if (this.room !== null) {
        return json({ error: '房间号已存在' }, 409);
      }
      const roomCode = this.ctx.id.name;
      if (roomCode === undefined) {
        return json({ error: '房间必须使用六位号码创建' }, 400);
      }
      this.room = new RoomEngine(roomCode, secureRandom, () => crypto.randomUUID());
      await this.persist();
      return json({ roomCode }, 201);
    }

    if (!isWebSocketUpgrade(request)) {
      return json({ error: '此地址需要 WebSocket 连接' }, 426);
    }
    if (this.room === null) {
      return json({ error: '房间不存在' }, 404);
    }

    const nickname = url.searchParams.get('nickname');
    const reconnect = url.searchParams.get('reconnect');
    let receipt: JoinReceipt;
    try {
      receipt = reconnect === null
        ? this.room.joinHuman(nickname ?? '')
        : this.room.reconnect(reconnect);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : '无法加入房间' }, 409);
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ sessionId: receipt.sessionId } satisfies ConnectionAttachment);
    await this.persist();
    server.send(JSON.stringify({ type: 'joined', receipt, view: this.room.getView(receipt.sessionId) }));
    this.broadcastViews();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    await this.ready;
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (attachment === null || this.room === null) {
      ws.send(JSON.stringify({ type: 'error', message: '连接没有对应的玩家座位' }));
      return;
    }

    try {
      const message = parseMessage(rawMessage);
      switch (message.type) {
        case 'add-bot':
          this.room.addBot(attachment.sessionId, message.seat);
          break;
        case 'remove-bot':
          this.room.removeBot(attachment.sessionId, message.seat);
          break;
        case 'set-timer':
          this.room.setTimer(attachment.sessionId, message.timer);
          break;
        case 'start':
          this.room.start(attachment.sessionId);
          break;
        case 'play':
          this.room.play(attachment.sessionId, message.cardIds, message.description);
          break;
        case 'pass':
          this.room.pass(attachment.sessionId);
          break;
        case 'quick-message':
          this.ctx.getWebSockets().forEach((connection) => {
            connection.send(JSON.stringify({
              from: attachment.sessionId,
              message: message.message.slice(0, 40),
              type: 'quick-message',
            }));
          });
          return;
      }
      this.runBotsUntilHuman();
      await this.persist();
      this.broadcastViews();
    } catch (error) {
      ws.send(JSON.stringify({
        message: error instanceof Error ? error.message : '消息处理失败',
        type: 'error',
      }));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.ready;
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (attachment !== null && this.room !== null) {
      this.room.disconnect(attachment.sessionId);
      await this.persist();
      this.broadcastViews();
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }
}

async function createRoom(env: Env): Promise<Response> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const roomCode = Math.floor(secureRandom() * 1_000_000).toString().padStart(6, '0');
    const stub = env.GAME_ROOMS.getByName(roomCode);
    const response = await stub.fetch(`https://room.internal/api/rooms/${roomCode}/initialize`, {
      method: 'POST',
    });
    if (response.status === 201) {
      return json({ roomCode }, 201);
    }
  }
  return json({ error: '暂时无法生成房间号，请重试' }, 503);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      return createRoom(env);
    }

    const roomCode = roomCodeFromPath(url.pathname);
    if (roomCode !== null) {
      return env.GAME_ROOMS.getByName(roomCode).fetch(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: '接口不存在' }, 404);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
