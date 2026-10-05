import type { Difficulty, Keys, WireTick } from "race-engine";

/**
 * Mirrors `apps/api/src/game/protocol.ts` — keep them in sync by hand when
 * either side changes. The race state itself (`WireTick`) is shared code in
 * `race-engine`'s wire.ts, so the heaviest part can't drift.
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

/** The race, in the compact format of `race-engine`'s wire.ts. */
export type StateMessage = { type: "state" } & WireTick;

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
  | { type: "start"; carIds: string[]; numbers: Record<string, number>; countdownMs: number }
  | StateMessage
  | { type: "finished"; standings: StandingEntry[] }
  /** `code: "busy"`: the server is at its race limit (the visitor is told). */
  | { type: "error"; message: string; code?: "busy" }
  | { type: "pong"; t: number }
  /** Sent locally when the socket closes; `busy` when the server turned us away (code 1013). */
  | { type: "room-closed"; busy?: boolean };

export type ClientMessage =
  | { event: "input"; data: Keys }
  | { event: "add-bot" }
  | { event: "remove-bot" }
  /** The leader sets one bot's difficulty. */
  | { event: "bot-difficulty"; data: { bot: string; difficulty: Difficulty } }
  | { event: "start" }
  /** Our clock reading, echoed back in `pong` to measure the round trip. */
  | { event: "ping"; data: number };

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
export function apiWsUrl(room?: string | null): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "ws://localhost:17100";
  return room ? `${base}/?room=${encodeURIComponent(room)}` : base;
}

/**
 * The API's plain HTTP address (ws → http, wss → https), for the wake-up
 * call; null in a production build without `NEXT_PUBLIC_API_URL` (CI, a
 * preview), where there's no API to wake and localhost isn't the visitor's.
 */
export function apiHttpUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (!configured && process.env.NODE_ENV === "production") return null;
  return (configured ?? "ws://localhost:17100").replace(/^ws/, "http");
}

/** Room codes as the API makes them (see its room.service.ts): only these go in a URL. */
export const isRoomCode = (code: string | null | undefined): code is string =>
  !!code && /^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/.test(code);

/** The page's address with an invite to `room` in online mode. */
export function inviteUrl(href: string, room: string): string {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("mode", "online");
  url.searchParams.set("room", room);
  return url.toString();
}

/** Same phases as practice mode's (but no pause: the race goes on for everyone), plus the lobby. */
export type OnlinePhase =
  "connecting" | "lobby" | "countdown" | "racing" | "finishing" | "finished" | "disconnected";

export type OnlineState = {
  phase: OnlinePhase;
  playerId: string | null;
  /** The room's code, for the invite link (and to regroup on "play again"). */
  roomId: string | null;
  laps: number;
  tickRate: number;
  participants: LobbyParticipant[];
  leaderId: string | null;
  /** The raw reason the server gave for rejecting the last action; English, developer-facing — never shown verbatim to the visitor. */
  error: string | null;
  carIds: string[];
  numbers: Record<string, number>;
  countdownMs: number;
  /** The server is full (too many races or connections): shown instead of a generic error. */
  busy: boolean;
  /** Set once the server says the race is over (skipping to the results doesn't). */
  standings: StandingEntry[] | null;
};

export const initialOnlineState: OnlineState = {
  phase: "connecting",
  playerId: null,
  roomId: null,
  laps: 2,
  tickRate: 30,
  participants: [],
  leaderId: null,
  error: null,
  carIds: [],
  numbers: {},
  countdownMs: 0,
  busy: false,
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
        roomId: msg.roomId,
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
            error: null,
            busy: false,
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
      return { ...state, error: msg.message, busy: msg.code === "busy" };
    case "room-closed":
      // The results stay up if the connection drops after the race.
      return state.phase === "finished"
        ? state
        : { ...state, phase: "disconnected", busy: msg.busy === true };
    case "state":
    case "pong":
      return state;
  }
}

export const isLeader = (state: OnlineState) =>
  state.playerId !== null && state.playerId === state.leaderId;
