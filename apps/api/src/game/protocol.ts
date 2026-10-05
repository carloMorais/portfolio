import type { Keys, RaceEvent } from "race-engine/node";

/**
 * What a client sends. The server assigns car ids and racer numbers; no free
 * text ever crosses the wire. `add-bot`/`remove-bot`/`start` are no-ops
 * unless the sender is the room's leader (the server replies with `error`
 * otherwise).
 */
export type ClientMessage =
  | { event: "input"; data: Keys }
  | { event: "add-bot" }
  | { event: "remove-bot" }
  | { event: "start" };

/**
 * `number` is a plain sequential racer number ("Piloto N"/"Driver N" is the
 * client's own wording, in the viewer's language — never a string from here).
 */
export type LobbyParticipant = { id: string; number: number; isBot: boolean };

export type CarSnapshot = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  laps: number;
  nitro: number;
  finishedAt: number | null;
};

export type StandingEntry = {
  carId: string;
  number: number;
  laps: number;
  lapTicks: number[];
  finishedAt: number | null;
};

/** What the server sends. Sent as plain JSON, not through Nest's request/response wrapping. */
export type ServerMessage =
  | {
      type: "welcome";
      playerId: string;
      number: number;
      roomId: string;
      laps: number;
      tickRate: number;
    }
  | { type: "lobby"; participants: LobbyParticipant[]; leaderId: string | null }
  | { type: "start"; carIds: string[]; numbers: Record<string, number> }
  | { type: "state"; tick: number; cars: CarSnapshot[]; items: string[]; events: RaceEvent[] }
  | { type: "finished"; standings: StandingEntry[] }
  | { type: "error"; message: string }
  | { type: "room-closed" };
