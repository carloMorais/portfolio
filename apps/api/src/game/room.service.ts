import { randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Keys } from "race-engine/node";
import { MAX_RACING_ROOMS } from "./limits";
import { Room, type ActionResult, type RoomClient } from "./room";

/** Room codes: short enough to read out loud, without look-alikes (0/o, 1/l/i). */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 6;
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** A room code a client may ask for (from an invite link); anything else is ignored. */
export const isRoomCode = (code: unknown): code is string =>
  typeof code === "string" && CODE_PATTERN.test(code);

/**
 * Finds an open room for a new player or opens one, and routes a client's
 * messages to the room it's in. In-memory only, as decided for the lite
 * online mode: no database, state is lost on redeploy.
 *
 * Every room has a short code, which the client turns into an invite link.
 * Joining with a code puts you in that room if it's still waiting and has a
 * seat; if no room has that code (it finished, or the server restarted), one
 * is opened under it, so friends who all press "play again" land together.
 * A room that's already racing or full falls back to the usual matchmaking.
 */
@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly clientRoom = new Map<RoomClient, string>();

  join(client: RoomClient, code?: string) {
    let room: Room | undefined;
    if (isRoomCode(code)) {
      const invited = this.rooms.get(code);
      if (!invited) room = this.open(code);
      else if (invited.state === "waiting" && !invited.isFull) room = invited;
    }
    room ??=
      [...this.rooms.values()].find((r) => r.state === "waiting" && !r.isFull) ??
      this.open(this.newCode());
    room.join(client);
    this.clientRoom.set(client, room.id);
  }

  private open(code: string): Room {
    const room = new Room(
      code,
      (r) => this.rooms.delete(r.id),
      (r) => this.rooms.delete(r.id),
    );
    this.rooms.set(code, room);
    return room;
  }

  private newCode(): string {
    for (;;) {
      const code = Array.from(
        { length: CODE_LENGTH },
        () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
      ).join("");
      if (!this.rooms.has(code)) return code;
    }
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
