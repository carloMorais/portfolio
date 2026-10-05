import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Keys } from "race-engine/node";
import { MAX_RACING_ROOMS } from "./limits";
import { Room, type ActionResult, type RoomClient } from "./room";

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

  setDifficulty(client: RoomClient, difficulty: unknown) {
    return this.room(client)?.setDifficulty(client, difficulty);
  }

  /**
   * Starts the client's room, unless `MAX_RACING_ROOMS` are already racing:
   * each running room costs CPU every tick, and Render's free plan has 0.1 CPU
   * for all of them (see limits.ts). The leader can simply try again shortly.
   */
  startRace(client: RoomClient): ActionResult | undefined {
    const room = this.room(client);
    if (!room) return undefined;
    const racing = [...this.rooms.values()].filter((r) => r.isRacing).length;
    if (room.state === "waiting" && racing >= MAX_RACING_ROOMS) {
      return { ok: false, message: "server busy: too many races running", code: "busy" };
    }
    return room.startRace(client);
  }

  private room(client: RoomClient): Room | undefined {
    const roomId = this.clientRoom.get(client);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  get roomCount() {
    return this.rooms.size;
  }
}
