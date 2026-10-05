import type { IncomingMessage } from "node:http";
import { NO_KEYS, type Keys } from "race-engine/node";

/**
 * Every protective limit of the online mode, in one place. The numbers come
 * from the load test of 05/10/2026 against Render's free plan (0.1 CPU,
 * 512 MB RAM, 5 GB/month of outbound bandwidth on a Hobby workspace):
 *
 * - one full room (10 cars) cost ~0.25 ms per tick on a desktop CPU, so
 *   assuming a Render vCPU ~2× slower, ~15 ms of CPU per second: 4 racing
 *   rooms use ~60% of the 0.1 CPU quota, leaving room for JSON and sockets;
 * - before these limits, one socket flooding inputs (~42k messages/s) took
 *   13–16% of a desktop core — more than the whole quota — and a single 20 MB
 *   message was accepted and cost 80 MB of RAM.
 */

/** Biggest message a client may send. Real ones are < 120 bytes; `ws` closes with 1009 above this. */
export const MAX_PAYLOAD_BYTES = 1024;
/** Rooms in countdown or racing at once (see the CPU estimate above). */
export const MAX_RACING_ROOMS = 4;
/** Open sockets at once, all rooms together (4 racing rooms of 10, plus lobbies). */
export const MAX_CONNECTIONS = 60;
/** Open sockets per IP: a few tabs are fine, a script opening hundreds isn't. */
export const MAX_CONNECTIONS_PER_IP = 4;
/**
 * A socket whose unsent data passes this is too far behind to ever catch up
 * (~25 s of state at ~10 KB/s): it's closed rather than left to fill memory.
 * Skipping messages instead isn't an option: clients rebuild items and lap
 * times from the events, so every message has to arrive.
 */
export const MAX_BUFFERED_BYTES = 256 * 1024;
/** Server → client ping frames; a socket that misses one pong is dropped. */
export const HEARTBEAT_MS = 20_000;

/** Close codes the client understands (`OnlineRace.tsx`). 1013 = "try again later". */
export const CLOSE_BUSY = 1013;
/** 1008 = policy violation: wrong origin or flooding. */
export const CLOSE_POLICY = 1008;
/** App-specific: the socket fell too far behind (see `MAX_BUFFERED_BYTES`). */
export const CLOSE_TOO_SLOW = 4001;

/**
 * Per-socket message budget (token bucket): `RATE` messages a second on
 * average, bursts up to `BURST`. The real client sends ~4 inputs/s while
 * driving plus one ping every 2 s, far below it. Excess messages are dropped;
 * a socket that keeps going way past the budget (`debt` below `-KICK_DEBT`)
 * is flooding and gets closed.
 */
export class MessageBudget {
  static readonly RATE = 40;
  static readonly BURST = 60;
  static readonly KICK_DEBT = 200;
  private tokens = MessageBudget.BURST;
  private last: number;

  constructor(private readonly now: () => number = Date.now) {
    this.last = now();
  }

  /** "ok": handle it; "drop": ignore it; "kick": close the socket. */
  take(): "ok" | "drop" | "kick" {
    const t = this.now();
    this.tokens = Math.min(
      MessageBudget.BURST,
      this.tokens + ((t - this.last) / 1000) * MessageBudget.RATE,
    );
    this.last = t;
    this.tokens -= 1;
    if (this.tokens >= 0) return "ok";
    return this.tokens < -MessageBudget.KICK_DEBT ? "kick" : "drop";
  }
}

/**
 * The only shape `input` may have: five booleans. Anything else (missing keys,
 * extra fields, strings) becomes `null` and the message is ignored, so a
 * client can't store arbitrary objects in the room.
 */
export function sanitizeKeys(data: unknown): Keys | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  const keys = { ...NO_KEYS };
  for (const k of Object.keys(NO_KEYS) as (keyof Keys)[]) {
    if (typeof d[k] !== "boolean") return null;
    keys[k] = d[k];
  }
  return keys;
}

/**
 * The visitor's IP. Behind Render's proxy the socket's own address is the
 * proxy's, so X-Forwarded-For is used when present — its LAST entry, the one
 * Render's proxy appends. The first entries come from the client itself and
 * can be forged ("X-Forwarded-For: 1.2.3.4"), which would dodge the per-IP cap.
 */
export function clientIp(req: IncomingMessage | undefined): string {
  const forwarded = req?.headers["x-forwarded-for"];
  const header = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
  const last = header?.split(",").at(-1)?.trim();
  return last || req?.socket.remoteAddress || "unknown";
}
