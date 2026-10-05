import type { Difficulty, Keys, WireTick } from "race-engine/node";

/**
 * What a client sends. The server assigns car ids and racer numbers; no free
 * text ever crosses the wire. `add-bot`/`remove-bot`/`difficulty`/`start` are
 * no-ops unless the sender is the room's leader (the server replies with
 * `error` otherwise). `ping` carries the client's own clock reading, echoed
 * back in `pong` so it can measure its round trip (for prediction).
 */
export type ClientMessage =
  | { event: "input"; data: Keys }
  | { event: "add-bot" }
  | { event: "remove-bot" }
  /** The leader sets one bot's difficulty. */
  | { event: "bot-difficulty"; data: { bot: string; difficulty: Difficulty } }
  | { event: "start" }
  | { event: "ping"; data: number };

/**
 * `number` is a plain sequential racer number ("Piloto N"/"Driver N" is the
 * client's own wording, in the viewer's language — never a string from here).
 */
export type LobbyParticipant = {
  id: string;
  number: number;
  isBot: boolean;
  /** Bots only: how this one drives, set by the leader. */
  difficulty?: Difficulty;
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
    }
  /**
   * The first tick runs `countdownMs` after this: the start lights, as in
   * practice mode. `carIds` is also the order of the cars in every `state`.
   */
  | { type: "start"; carIds: string[]; numbers: Record<string, number>; countdownMs: number }
  /** The race, in the compact format of `race-engine`'s wire.ts (see there). */
  | ({ type: "state" } & WireTick)
  | { type: "finished"; standings: StandingEntry[] }
  /**
   * A rejected action. `message` is English and developer-facing, never shown
   * to visitors; `code: "busy"` means the server is at its room limit, which
   * the client does explain.
   */
  | { type: "error"; message: string; code?: "busy" }
  | { type: "pong"; t: number }
  | { type: "room-closed" };
