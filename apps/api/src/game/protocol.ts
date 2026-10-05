import type { Difficulty, Keys, RaceEvent } from "race-engine/node";

/**
 * What a client sends. The server assigns car ids and racer numbers; no free
 * text ever crosses the wire. `add-bot`/`remove-bot`/`difficulty`/`start` are
 * no-ops unless the sender is the room's leader (the server replies with
 * `error` otherwise).
 */
export type ClientMessage =
  | { event: "input"; data: Keys }
  | { event: "add-bot" }
  | { event: "remove-bot" }
  | { event: "difficulty"; data: Difficulty }
  | { event: "start" };

/**
 * `number` is a plain sequential racer number ("Piloto N"/"Driver N" is the
 * client's own wording, in the viewer's language — never a string from here).
 */
export type LobbyParticipant = { id: string; number: number; isBot: boolean };

/**
 * What the client needs to rank, warn and draw a car the same way practice
 * mode does (standings, wrong way, next checkpoint, nitro bar, lap times).
 * The rest of the engine's `Car` is physics state only the server uses.
 */
export type CarSnapshot = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  vx: number;
  vy: number;
  checkpoint: number;
  waypoint: number;
  laps: number;
  nitro: number;
  nitroUntil: number | null;
  finishedAt: number | null;
  lapTicks: number[];
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
  | {
      type: "lobby";
      participants: LobbyParticipant[];
      leaderId: string | null;
      /** How the bots drive, chosen by the leader. */
      difficulty: Difficulty;
    }
  /** The first tick runs `countdownMs` after this: the start lights, as in practice mode. */
  | { type: "start"; carIds: string[]; numbers: Record<string, number>; countdownMs: number }
  | {
      type: "state";
      tick: number;
      cars: CarSnapshot[];
      items: string[];
      /** Car ids in finishing order. */
      finished: string[];
      events: RaceEvent[];
    }
  | { type: "finished"; standings: StandingEntry[] }
  | { type: "error"; message: string }
  | { type: "room-closed" };
