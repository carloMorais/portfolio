import type { Keys, RaceEvent } from "race-engine";

/**
 * Mirrors `apps/api/src/game/protocol.ts` — the two aren't a shared package,
 * so keep them in sync by hand when either side changes.
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

export type ClientMessage =
  | { event: "input"; data: Keys }
  | { event: "add-bot" }
  | { event: "remove-bot" }
  | { event: "start" };

/** The Render free tier sleeps after 15 min idle, so a first connect can take up to ~1 min. */
export function apiWsUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "ws://localhost:17100";
}

export type OnlinePhase = "connecting" | "lobby" | "racing" | "finished" | "disconnected";

export type OnlineState = {
  phase: OnlinePhase;
  playerId: string | null;
  laps: number;
  tickRate: number;
  participants: LobbyParticipant[];
  leaderId: string | null;
  /** The raw reason the server gave for rejecting the last action; English, developer-facing — never shown verbatim to the visitor. */
  error: string | null;
  carIds: string[];
  numbers: Record<string, number>;
  standings: StandingEntry[] | null;
};

export const initialOnlineState: OnlineState = {
  phase: "connecting",
  playerId: null,
  laps: 2,
  tickRate: 30,
  participants: [],
  leaderId: null,
  error: null,
  carIds: [],
  numbers: {},
  standings: null,
};

/**
 * Pure lobby/race state machine driven by server messages — kept separate
 * from the WebSocket/canvas glue (`OnlineRace.tsx`) so it's unit-testable
 * without mocking a socket. High-frequency `state` ticks aren't handled
 * here: they drive the render loop directly through refs, never React state.
 */
export function applyServerMessage(state: OnlineState, msg: ServerMessage): OnlineState {
  switch (msg.type) {
    case "welcome":
      return {
        ...state,
        playerId: msg.playerId,
        laps: msg.laps,
        tickRate: msg.tickRate,
        phase: "lobby",
      };
    case "lobby":
      // A lobby broadcast can arrive after the race has already started (a
      // late straggler's disconnect, say); once racing, the roster is frozen.
      return state.phase === "racing" || state.phase === "finished"
        ? state
        : { ...state, participants: msg.participants, leaderId: msg.leaderId, error: null };
    case "start":
      return {
        ...state,
        carIds: msg.carIds,
        numbers: msg.numbers,
        phase: "racing",
        standings: null,
      };
    case "finished":
      return { ...state, phase: "finished", standings: msg.standings };
    case "error":
      return { ...state, error: msg.message };
    case "room-closed":
      return { ...state, phase: "disconnected" };
    case "state":
      return state;
  }
}

export const isLeader = (state: OnlineState) =>
  state.playerId !== null && state.playerId === state.leaderId;
