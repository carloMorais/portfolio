import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Keys } from "race-engine/node";
import { Room, type RoomClient } from "./room";

/**
 * Finds an open room for a new player or opens one, and routes a client's
 * messages to the room it's in. In-memory only, as decided for the lite
 * online mode: no database, state is lost on redeploy.
 */
@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly clientRoom = new Map<RoomClient, string>();

  join(client: RoomClient) {
    let room = [...this.rooms.values()].find((r) => r.state === "waiting" && !r.isFull);
    if (!room) {
      room = new Room(
        randomUUID(),
        (r) => this.rooms.delete(r.id),
        (r) => this.rooms.delete(r.id),
      );
      this.rooms.set(room.id, room);
    }
    room.join(client);
    this.clientRoom.set(client, room.id);
  }

  leave(client: RoomClient) {
    const roomId = this.clientRoom.get(client);
    if (!roomId) return;
    this.clientRoom.delete(client);
    this.rooms.get(roomId)?.leave(client);
  }

  input(client: RoomClient, keys: Keys) {
    this.room(client)?.setInput(client, keys);
  }

  addBot(client: RoomClient) {
    return this.room(client)?.addBot(client);
  }

  removeBot(client: RoomClient) {
    return this.room(client)?.removeBot(client);
  }

  startRace(client: RoomClient) {
    return this.room(client)?.startRace(client);
  }

  private room(client: RoomClient): Room | undefined {
    const roomId = this.clientRoom.get(client);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  get roomCount() {
    return this.rooms.size;
  }
}
