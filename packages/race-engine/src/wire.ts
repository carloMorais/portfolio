import { PHYSICS } from "./constants.ts";
import { createRace } from "./race.ts";
import type { Car, RaceEvent, RaceState, Track } from "./types.ts";

/**
 * The online mode's compact wire format, shared by the server (encodes) and
 * the browser (decodes) so the two can't drift apart.
 *
 * Why it exists: sending each car as a JSON object with every field, plus the
 * active items and the finishing order, cost ~1.85 KB per tick at 30 ticks/s,
 * ~55 KB/s per player — and a Render Hobby workspace includes only 5 GB of
 * outbound bandwidth a month (measured 05/10/2026). This format sends:
 *
 * - each car as a fixed-order array of numbers (no keys), in the order of the
 *   `carIds` the race started with;
 * - only what changes every tick; what changes rarely (items on the track,
 *   lap times, the finishing order) is never sent at all: the decoder rebuilds
 *   it from the events (`pickup`, `respawn`, `lap`), which the server sends
 *   once each, in order, over TCP.
 *
 * Every number round-trips exactly (the engine already rounds positions and
 * speeds to 2 decimals), so a client can also predict from a decoded car.
 */

/**
 * One car: [x, y, rotation, vx, vy, rotationSpeed, deceleration, align,
 * checkpoint, waypoint, laps, nitro, nitroUntil, finishedAt, lapStartedAt].
 * The physics-only fields (rotationSpeed, deceleration, align, lapStartedAt)
 * are there for client-side prediction of your own car.
 */
export type WireCar = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number | null,
  number,
  number,
  number,
  number,
  number | null,
  number | null,
  number,
];

/** One state message: the latest tick's cars and every event since the last message. */
export type WireTick = { t: number; c: WireCar[]; e?: RaceEvent[] };

export const encodeCar = (c: Car): WireCar => [
  c.x,
  c.y,
  c.rotation,
  c.vx,
  c.vy,
  c.rotationSpeed,
  c.deceleration,
  c.align,
  c.checkpoint,
  c.waypoint,
  c.laps,
  c.nitro,
  c.nitroUntil,
  c.finishedAt,
  c.lapStartedAt,
];

/**
 * A state message for `state`, carrying `events` (every event since the last
 * message, oldest first: messages can be sent less often than ticks run).
 */
export function encodeTick(state: RaceState, events: RaceEvent[]): WireTick {
  const msg: WireTick = { t: state.tick, c: state.cars.map(encodeCar) };
  // Most ticks have no events: leave the key out instead of sending "e":[].
  if (events.length > 0) msg.e = events;
  return msg;
}

/**
 * Rebuilds the engine's own `RaceState` from state messages, so the browser can
 * rank, warn and draw with the engine's helpers unchanged. Feed it every
 * message, in order, from the start of the race.
 */
export class RaceDecoder {
  // Plain fields, not constructor parameter properties: Node runs this package's
  // .ts directly, and only erasable TypeScript syntax is allowed there.
  private readonly track: Track;
  private readonly carIds: string[];
  private readonly laps: number;
  private readonly lapTicks: number[][];
  private finished: string[] = [];
  /** Items off the track (presence is all `activeItems` needs, not the exact return tick). */
  private readonly picked = new Map<string, number>();

  constructor(track: Track, carIds: string[], laps: number) {
    this.track = track;
    this.carIds = carIds;
    this.laps = laps;
    this.lapTicks = carIds.map(() => []);
  }

  /** The grid before the first tick, as `createRace` places it. */
  initial(): RaceState {
    return createRace(this.track, this.carIds, this.laps);
  }

  /**
   * Picks up a race already under way (see `RaceSync`): restores what the
   * missed events built, then applies the latest tick. Keep feeding it the
   * state messages that follow.
   */
  resume(sync: RaceSync): RaceState {
    this.lapTicks.forEach((laps, i) => laps.splice(0, laps.length, ...(sync.lapTicks[i] ?? [])));
    this.finished = [...sync.finished];
    this.picked.clear();
    for (const [id, at] of Object.entries(sync.picked)) this.picked.set(id, at);
    return this.apply(sync.state);
  }

  /** Applies one message and returns a fresh state (never mutated later). */
  apply(msg: WireTick): RaceState {
    const events = msg.e ?? [];
    for (const ev of events) {
      if (ev.type === "pickup") {
        this.picked.set(ev.item, msg.t + PHYSICS.itemRespawnTicks);
      } else if (ev.type === "respawn") {
        this.picked.delete(ev.item);
      } else if (ev.type === "lap") {
        const i = this.carIds.indexOf(ev.car);
        if (i !== -1) this.lapTicks[i]!.push(ev.ticks);
        if (ev.finished) this.finished.push(ev.car);
      }
    }
    return {
      tick: msg.t,
      laps: this.laps,
      cars: msg.c.map((w, i) => ({
        id: this.carIds[i]!,
        x: w[0],
        y: w[1],
        width: PHYSICS.carSize,
        height: PHYSICS.carSize,
        rotation: w[2],
        vx: w[3],
        vy: w[4],
        rotationSpeed: w[5],
        deceleration: w[6],
        align: w[7],
        checkpoint: w[8],
        waypoint: w[9],
        laps: w[10],
        nitro: w[11],
        nitroUntil: w[12],
        finishedAt: w[13],
        lapStartedAt: w[14],
        lapTicks: [...this.lapTicks[i]!],
      })),
      itemRespawnAt: Object.fromEntries(this.picked),
      finished: [...this.finished],
      events,
    };
  }
}

/**
 * What a client that wasn't there from the start needs (someone reconnecting
 * mid-race, or watching a race already under way): everything the decoder
 * would otherwise have rebuilt from the events it missed — lap times, the
 * finishing order, the items off the track — plus the latest tick. The
 * server sends it right after a state message, so the events in that message
 * are already counted here and the next message carries only newer ones.
 */
export type RaceSync = {
  lapTicks: number[][];
  finished: string[];
  picked: Record<string, number>;
  state: WireTick;
};

export const encodeSync = (state: RaceState): RaceSync => ({
  lapTicks: state.cars.map((c) => [...c.lapTicks]),
  finished: [...state.finished],
  picked: { ...state.itemRespawnAt },
  state: encodeTick(state, []),
});
