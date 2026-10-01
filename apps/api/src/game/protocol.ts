import type { Keys, RaceEvent } from "race-engine/node";

/** What a client sends. The server assigns names and car ids; no free text ever crosses the wire. */
export type ClientMessage = { event: "input"; data: Keys };

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
  name: string;
  laps: number;
  lapTicks: number[];
  finishedAt: number | null;
};

/** What the server sends. Sent as plain JSON, not through Nest's request/response wrapping. */
export type ServerMessage =
  | {
      type: "welcome";
      playerId: string;
      name: string;
      roomId: string;
      laps: number;
      tickRate: number;
    }
  | { type: "roster"; names: string[]; secondsLeft: number }
  | { type: "start"; carIds: string[]; names: Record<string, string> }
  | { type: "state"; tick: number; cars: CarSnapshot[]; events: RaceEvent[] }
  | { type: "finished"; standings: StandingEntry[] }
  | { type: "room-closed" };
