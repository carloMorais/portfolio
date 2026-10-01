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
import { RoomService } from "./room.service";

/**
 * Every connection joins the next open room (or starts one); the room itself
 * owns names, cars and the tick loop. Mirrors the original's lobby-less
 * matchmaking (ciclo 2 RaceGame put you straight into a room, never a name
 * prompt), but server-authoritative.
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
}
