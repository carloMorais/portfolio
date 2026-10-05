import { createCar, type Difficulty, type Keys, type RaceEvent, type RaceState } from "race-engine";

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

export type StateMessage = {
  type: "state";
  tick: number;
  cars: CarSnapshot[];
  items: string[];
  finished: string[];
  events: RaceEvent[];
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
  | {
      type: "lobby";
      participants: LobbyParticipant[];
      leaderId: string | null;
      difficulty: Difficulty;
    }
  | { type: "start"; carIds: string[]; numbers: Record<string, number>; countdownMs: number }
  | StateMessage
  | { type: "finished"; standings: StandingEntry[] }
  | { type: "error"; message: string }
  | { type: "room-closed" };

export type ClientMessage =
  | { event: "input"; data: Keys }
  | { event: "add-bot" }
  | { event: "remove-bot" }
  | { event: "difficulty"; data: Difficulty }
  | { event: "start" };

/**
 * What happens on this side only: the start lights going out, you crossing
 * the line (the others still racing), skipping to the results, and
 * connecting again.
 */
export type LocalAction =
  | { type: "lights-out" }
  | { type: "you-finished" }
  | { type: "skip" }
  /** A fresh connection (play again, reconnect): back to square one. */
  | { type: "reconnect" };

/** The Render free tier sleeps after 15 min idle, so a first connect can take up to ~1 min. */
export function apiWsUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "ws://localhost:17100";
}

/** Same phases as practice mode's (but no pause: the race goes on for everyone), plus the lobby. */
export type OnlinePhase =
  "connecting" | "lobby" | "countdown" | "racing" | "finishing" | "finished" | "disconnected";

export type OnlineState = {
  phase: OnlinePhase;
  playerId: string | null;
  laps: number;
  tickRate: number;
  participants: LobbyParticipant[];
  leaderId: string | null;
  difficulty: Difficulty;
  /** The raw reason the server gave for rejecting the last action; English, developer-facing — never shown verbatim to the visitor. */
  error: string | null;
  carIds: string[];
  numbers: Record<string, number>;
  countdownMs: number;
  /** Set once the server says the race is over (skipping to the results doesn't). */
  standings: StandingEntry[] | null;
};

export const initialOnlineState: OnlineState = {
  phase: "connecting",
  playerId: null,
  laps: 2,
  tickRate: 30,
  participants: [],
  leaderId: null,
  difficulty: "normal",
  error: null,
  carIds: [],
  numbers: {},
  countdownMs: 0,
  standings: null,
};

/**
 * Pure lobby/race state machine driven by server messages and a few local
 * moments — kept separate from the WebSocket/canvas glue (`OnlineRace.tsx`)
 * so it's unit-testable without mocking a socket. High-frequency `state`
 * ticks aren't handled here: they drive the render loop directly through
 * refs, never React state.
 */
export function applyServerMessage(
  state: OnlineState,
  msg: ServerMessage | LocalAction,
): OnlineState {
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
      return state.phase !== "lobby" && state.phase !== "connecting"
        ? state
        : {
            ...state,
            participants: msg.participants,
            leaderId: msg.leaderId,
            difficulty: msg.difficulty,
            error: null,
          };
    case "start":
      return {
        ...state,
        carIds: msg.carIds,
        numbers: msg.numbers,
        countdownMs: msg.countdownMs,
        phase: "countdown",
        standings: null,
      };
    case "reconnect":
      return initialOnlineState;
    case "lights-out":
      return state.phase === "countdown" ? { ...state, phase: "racing" } : state;
    case "you-finished":
      return state.phase === "racing" || state.phase === "countdown"
        ? { ...state, phase: "finishing" }
        : state;
    case "skip":
      return state.phase === "finishing" ? { ...state, phase: "finished" } : state;
    case "finished":
      return { ...state, phase: "finished", standings: msg.standings };
    case "error":
      return { ...state, error: msg.message };
    case "room-closed":
      // The results stay up if the connection drops after the race.
      return state.phase === "finished" ? state : { ...state, phase: "disconnected" };
    case "state":
      return state;
  }
}

export const isLeader = (state: OnlineState) =>
  state.playerId !== null && state.playerId === state.leaderId;

/**
 * A server tick as the engine's own `RaceState`, so the practice-mode
 * renderer, standings and warnings work on it unchanged. The physics-only
 * fields the server doesn't send keep the engine's defaults.
 */
export function toRaceState(msg: StateMessage, laps: number, itemIds: string[]): RaceState {
  const on = new Set(msg.items);
  return {
    tick: msg.tick,
    laps,
    cars: msg.cars.map((c) => ({ ...createCar(c.id, c.x, c.y), ...c })),
    // Only presence matters to `activeItems`, not when an item comes back.
    itemRespawnAt: Object.fromEntries(itemIds.filter((id) => !on.has(id)).map((id) => [id, 0])),
    finished: msg.finished,
    events: msg.events,
  };
}
