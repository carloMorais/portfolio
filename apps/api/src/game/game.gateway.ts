import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Keys } from "race-engine/node";
import type { WebSocket } from "ws";
import type { ServerMessage } from "./protocol";
import { RoomService } from "./room.service";

/**
 * Every connection joins the next open room (or starts one); the room itself
 * owns names, cars and the tick loop. Mirrors the original's lobby-less
 * matchmaking (ciclo 2 RaceGame put you straight into a room, never a name
 * prompt), but server-authoritative. Unlike the original, starting is
 * manual: the room's leader adds/removes bots and starts when ready, never a
 * timer — `add-bot`/`remove-bot`/`difficulty`/`start` reply with an `error` (sent back to
 * just the caller, via Nest's own response-to-sender) when rejected; a
 * successful action needs no reply, since the room already broadcasts the
 * updated lobby.
 */
@WebSocketGateway()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly rooms: RoomService) {}

  handleConnection(client: WebSocket) {
    this.rooms.join(client);
  }

  handleDisconnect(client: WebSocket) {
    this.rooms.leave(client);
  }

  @SubscribeMessage("input")
  handleInput(@ConnectedSocket() client: WebSocket, @MessageBody() data: Keys) {
    this.rooms.input(client, data);
  }

  @SubscribeMessage("add-bot")
  handleAddBot(@ConnectedSocket() client: WebSocket): ServerMessage | undefined {
    const result = this.rooms.addBot(client);
    return result && !result.ok ? { type: "error", message: result.message } : undefined;
  }

  @SubscribeMessage("remove-bot")
  handleRemoveBot(@ConnectedSocket() client: WebSocket): ServerMessage | undefined {
    const result = this.rooms.removeBot(client);
    return result && !result.ok ? { type: "error", message: result.message } : undefined;
  }

  @SubscribeMessage("difficulty")
  handleDifficulty(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: unknown,
  ): ServerMessage | undefined {
    const result = this.rooms.setDifficulty(client, data);
    return result && !result.ok ? { type: "error", message: result.message } : undefined;
  }

  @SubscribeMessage("start")
  handleStart(@ConnectedSocket() client: WebSocket): ServerMessage | undefined {
    const result = this.rooms.startRace(client);
    return result && !result.ok ? { type: "error", message: result.message } : undefined;
  }
}
