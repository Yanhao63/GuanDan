import { DurableObject } from 'cloudflare:workers';
import {
  RoomEngine,
  type JoinReceipt,
  type RoomPlayEvent,
  type RoomSnapshot,
} from '../src/game/room';
import type { Seat } from '../src/game/rules/match';
import type { TimerChoice } from '../src/game/types';

interface Env {
  ASSETS: Fetcher;
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
}

interface ConnectionAttachment {
  connectionId: string;
  sessionId: string;
}

type ClientMessage =
  | { seat: Seat; type: 'add-bot' }
  | { seat: Seat; type: 'remove-bot' }
  | { firstSeat: Seat; secondSeat: Seat; type: 'swap-seats' }
  | { timer: TimerChoice; type: 'set-timer' }
  | { type: 'start' }
  | { type: 'start-next-deal' }
  | { cardIds: string[]; description?: string; type: 'play' }
  | { type: 'pass' }
  | { cardId: string; type: 'pay-tribute' }
  | { cardId: string; type: 'choose-double-tribute' }
  | { cardId: string; type: 'return-tribute' }
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

  private async syncAlarm(): Promise<void> {
    const deadlines = [
      this.room?.getNextBotActionDeadline() ?? null,
      this.room?.getNextDisconnectDeadline() ?? null,
      this.room?.getNextTurnDeadline() ?? null,
    ].filter((deadline): deadline is number => deadline !== null);
    if (deadlines.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(Math.min(...deadlines), Date.now() + 1));
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

  private broadcastPlayEvent(event: RoomPlayEvent): void {
    const message = JSON.stringify({
      event: { ...event, id: crypto.randomUUID() },
      type: 'play-event',
    });
    this.ctx.getWebSockets().forEach((ws) => {
      try {
        ws.send(message);
      } catch {
        // The connection may have closed between enumeration and send.
      }
    });
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

    const connectionId = crypto.randomUUID();
    this.room.attachConnection(receipt.sessionId, connectionId);
    this.ctx.getWebSockets().forEach((connection) => {
      const existing = connection.deserializeAttachment() as ConnectionAttachment | null;
      if (existing?.sessionId === receipt.sessionId) {
        connection.close(1000, '同一座位已建立新连接');
      }
    });

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ connectionId, sessionId: receipt.sessionId } satisfies ConnectionAttachment);
    await this.persist();
    await this.syncAlarm();
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
      let playEvent: RoomPlayEvent | null = null;
      switch (message.type) {
        case 'add-bot':
          this.room.addBot(attachment.sessionId, message.seat);
          break;
        case 'remove-bot':
          this.room.removeBot(attachment.sessionId, message.seat);
          break;
        case 'swap-seats':
          this.room.swapSeats(attachment.sessionId, message.firstSeat, message.secondSeat);
          break;
        case 'set-timer':
          this.room.setTimer(attachment.sessionId, message.timer);
          break;
        case 'start':
          this.room.start(attachment.sessionId);
          break;
        case 'start-next-deal':
          this.room.startNextDeal(attachment.sessionId);
          break;
        case 'play':
          playEvent = this.room.play(attachment.sessionId, message.cardIds, message.description);
          break;
        case 'pass':
          playEvent = this.room.pass(attachment.sessionId);
          break;
        case 'pay-tribute':
          this.room.payTribute(attachment.sessionId, message.cardId);
          break;
        case 'choose-double-tribute':
          this.room.chooseDoubleTribute(attachment.sessionId, message.cardId);
          break;
        case 'return-tribute':
          this.room.returnTribute(attachment.sessionId, message.cardId);
          break;
        case 'quick-message':
          if (message.message.trim().length === 0) {
            throw new Error('消息不能为空');
          }
          const chatMessage = JSON.stringify({
            chat: {
              id: crypto.randomUUID(),
              message: message.message.trim().slice(0, 40),
              player: this.room.getSeatForSession(attachment.sessionId),
            },
            type: 'quick-message',
          });
          this.ctx.getWebSockets().forEach((connection) => {
            try {
              connection.send(chatMessage);
            } catch {
              // The connection may have closed between enumeration and send.
            }
          });
          return;
      }
      if (playEvent !== null) {
        this.broadcastPlayEvent(playEvent);
      }
      await this.persist();
      await this.syncAlarm();
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
      this.room.disconnect(attachment.sessionId, Date.now(), attachment.connectionId);
      await this.persist();
      await this.syncAlarm();
      this.broadcastViews();
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async alarm(): Promise<void> {
    await this.ready;
    if (this.room === null) {
      return;
    }
    const now = Date.now();
    this.room.applyDisconnectTimeouts(now);
    this.room.applyTurnTimeout(now, (event) => this.broadcastPlayEvent(event));
    this.room.runCurrentBotTurn(now, (event) => this.broadcastPlayEvent(event));
    await this.persist();
    await this.syncAlarm();
    this.broadcastViews();
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
