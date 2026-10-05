import type { IncomingMessage } from "node:http";
import type { OnModuleDestroy } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { WebSocket } from "ws";
import { isAllowedOrigin } from "../origins";
import {
  CLOSE_BUSY,
  CLOSE_POLICY,
  HEARTBEAT_MS,
  MAX_CONNECTIONS,
  MAX_CONNECTIONS_PER_IP,
  MAX_PAYLOAD_BYTES,
  MessageBudget,
  clientIp,
  sanitizeKeys,
} from "./limits";
import type { ServerMessage } from "./protocol";
import type { ActionResult } from "./room";
import { RoomService } from "./room.service";

/**
 * Every connection joins the room of its invite code, else the next open room
 * (or starts one); the room itself
 * owns names, cars and the tick loop. Mirrors the original's lobby-less
 * matchmaking (ciclo 2 RaceGame put you straight into a room, never a name
 * prompt), but server-authoritative. Unlike the original, starting is
 * manual: the room's leader adds/removes bots and starts when ready, never a
 * timer — `add-bot`/`remove-bot`/`bot-difficulty`/`color`/`start` reply with an `error`
 * (sent back to just the caller, via Nest's own response-to-sender) when
 * rejected; a successful action needs no reply, since the room already
 * broadcasts the updated lobby.
 *
 * It's also the server's front door, so the protective limits live here (see
 * limits.ts for the numbers and why): messages bigger than
 * `MAX_PAYLOAD_BYTES` are refused by `ws` itself; sockets from other sites,
 * past the connection caps, flooding messages or ignoring pings are closed.
 */
@WebSocketGateway({ maxPayload: MAX_PAYLOAD_BYTES })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  /** Admitted sockets and their IP (for the per-IP cap). */
  private readonly clients = new Map<WebSocket, string>();
  private readonly perIp = new Map<string, number>();
  private readonly budgets = new WeakMap<WebSocket, MessageBudget>();
  /** Sockets that answered the last ping (see `beat`). */
  private readonly alive = new WeakSet<WebSocket>();
  private readonly heartbeat = setInterval(() => this.beat(), HEARTBEAT_MS).unref();

  constructor(private readonly rooms: RoomService) {}

  handleConnection(client: WebSocket, req?: IncomingMessage) {
    // Browsers don't apply CORS to WebSockets: check the origin by hand.
    if (!isAllowedOrigin(req?.headers.origin)) {
      client.close(CLOSE_POLICY, "origin not allowed");
      return;
    }
    const ip = clientIp(req);
    if (
      this.clients.size >= MAX_CONNECTIONS ||
      (this.perIp.get(ip) ?? 0) >= MAX_CONNECTIONS_PER_IP
    ) {
      client.close(CLOSE_BUSY, "server busy");
      return;
    }
    this.clients.set(client, ip);
    this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
    this.budgets.set(client, new MessageBudget());
    this.alive.add(client);
    client.on("pong", () => this.alive.add(client));
    // An invite link connects with ?room=<code> (validated by the service).
    const code = new URL(req?.url ?? "/", "http://localhost").searchParams.get("room");
    this.rooms.join(client, code ?? undefined);
  }

  handleDisconnect(client: WebSocket) {
    const ip = this.clients.get(client);
    if (ip === undefined) return; // refused at the door: never joined a room
    this.clients.delete(client);
    const left = (this.perIp.get(ip) ?? 1) - 1;
    if (left > 0) this.perIp.set(ip, left);
    else this.perIp.delete(ip);
    this.rooms.leave(client);
  }

  onModuleDestroy() {
    clearInterval(this.heartbeat);
  }

  @SubscribeMessage("input")
  handleInput(@ConnectedSocket() client: WebSocket, @MessageBody() data: unknown) {
    if (!this.allow(client)) return;
    const keys = sanitizeKeys(data);
    if (keys) this.rooms.input(client, keys);
  }

  @SubscribeMessage("add-bot")
  handleAddBot(@ConnectedSocket() client: WebSocket): ServerMessage | undefined {
    if (!this.allow(client)) return undefined;
    return this.reply(this.rooms.addBot(client));
  }

  @SubscribeMessage("remove-bot")
  handleRemoveBot(@ConnectedSocket() client: WebSocket): ServerMessage | undefined {
    if (!this.allow(client)) return undefined;
    return this.reply(this.rooms.removeBot(client));
  }

  @SubscribeMessage("bot-difficulty")
  handleDifficulty(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: unknown,
  ): ServerMessage | undefined {
    if (!this.allow(client)) return undefined;
    return this.reply(this.rooms.setBotDifficulty(client, data));
  }

  @SubscribeMessage("color")
  handleColor(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: unknown,
  ): ServerMessage | undefined {
    if (!this.allow(client)) return undefined;
    return this.reply(this.rooms.setColor(client, data));
  }

  @SubscribeMessage("start")
  handleStart(@ConnectedSocket() client: WebSocket): ServerMessage | undefined {
    if (!this.allow(client)) return undefined;
    return this.reply(this.rooms.startRace(client));
  }

  /** Echoes the client's clock reading, so it can measure its round trip. */
  @SubscribeMessage("ping")
  handlePing(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: unknown,
  ): ServerMessage | undefined {
    if (!this.allow(client)) return undefined;
    return typeof data === "number" && Number.isFinite(data)
      ? { type: "pong", t: data }
      : undefined;
  }

  private reply(result: ActionResult | undefined): ServerMessage | undefined {
    if (!result || result.ok) return undefined;
    return { type: "error", message: result.message, ...(result.code && { code: result.code }) };
  }

  /** Spends one message from the socket's budget; closes it if it's flooding. */
  private allow(client: WebSocket): boolean {
    const verdict = this.budgets.get(client)?.take() ?? "drop";
    // terminate(), not close(): close() waits for the peer to answer the close
    // handshake, and a flooding client just keeps sending — measured: the
    // server kept parsing its messages at 10–15% CPU. terminate() drops the
    // TCP connection at once (the client sees code 1006).
    if (verdict === "kick") client.terminate();
    return verdict === "ok";
  }

  /**
   * Pings every socket; one that didn't answer the previous ping is gone
   * (a phone that lost signal never sends a close) and is terminated, which
   * frees its seat and its share of the connection caps. Browsers answer
   * ping frames on their own. The steady traffic also keeps idle lobby
   * connections from being cut by proxies.
   */
  private beat() {
    for (const client of this.clients.keys()) {
      if (!this.alive.has(client)) {
        client.terminate();
        continue;
      }
      this.alive.delete(client);
      client.ping();
    }
  }
}
