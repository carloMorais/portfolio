import { NO_KEYS, TICK_RATE, stepRace, type Car, type Keys, type RaceState } from "race-engine";
import { classicTrack as track } from "race-engine";
import { interpolateCar } from "./draw";

/**
 * The online mode's netcode on the browser side, kept free of React and the
 * socket so it can be unit-tested (`net.test.ts`):
 *
 * - `SnapshotBuffer`: everyone else is drawn slightly in the past, between
 *   two real server states, so uneven network delays don't make cars stutter;
 * - `KeyTimeline` + `Predictor`: your own car is drawn ahead, at the moment
 *   your current keys will reach the server, by running the engine locally on
 *   top of the latest server state — so it answers your keys at once instead
 *   of a round trip later (measured 120–200 ms from Brazil to Render's US
 *   regions is typical);
 * - `Smoother`: when the server disagrees with the prediction, the car glides
 *   to the right place instead of jumping.
 */

export const STEP_MS = 1000 / TICK_RATE;

/**
 * How far in the past the other cars are drawn, in ticks. The server sends
 * every 2nd tick (`SEND_EVERY`), so 2 ticks is the gap between messages; 2
 * more absorb a late message without running out of states to show (133 ms).
 */
export const INTERP_DELAY_TICKS = 4;

/** Prediction never runs more than this far ahead (a bad RTT reading or a long stall). */
const MAX_PREDICT_TICKS = 15;

/** How long clock samples count when estimating the server's tick clock (see `base`). */
const CLOCK_WINDOW_MS = 3000;

type Snapshot = { tick: number; state: RaceState };

export class SnapshotBuffer {
  private snaps: Snapshot[] = [];
  private clock: { at: number; offset: number }[] = [];

  /** A decoded server state that arrived at local time `arrival` (ms). */
  push(state: RaceState, arrival: number) {
    this.snaps.push({ tick: state.tick, state });
    if (this.snaps.length > 30) this.snaps.shift();
    // Each message says "tick T existed by `arrival`". The smallest
    // arrival − T·step over the last few seconds is the least-delayed message,
    // the best estimate of when the server ran tick 0 in local time.
    this.clock.push({ at: arrival, offset: arrival - state.tick * STEP_MS });
    while (this.clock.length > 1 && this.clock[0]!.at < arrival - CLOCK_WINDOW_MS) {
      this.clock.shift();
    }
  }

  get latest(): RaceState | null {
    return this.snaps.at(-1)?.state ?? null;
  }

  clear() {
    this.snaps = [];
    this.clock = [];
  }

  /** The server tick to show at local time `now` (fractional). */
  renderTick(now: number): number {
    const base = Math.min(...this.clock.map((c) => c.offset));
    return (now - base) / STEP_MS - INTERP_DELAY_TICKS;
  }

  /**
   * The two states around the tick to show, and how far between them. Before
   * the first or past the last state it holds that one (alpha 0) rather than
   * guessing.
   */
  sample(now: number): { a: RaceState; b: RaceState; alpha: number } | null {
    const n = this.snaps.length;
    if (n === 0) return null;
    const t = this.renderTick(now);
    if (t <= this.snaps[0]!.tick)
      return { a: this.snaps[0]!.state, b: this.snaps[0]!.state, alpha: 0 };
    for (let i = n - 1; i > 0; i--) {
      const a = this.snaps[i - 1]!;
      const b = this.snaps[i]!;
      if (t >= a.tick && t <= b.tick) {
        return { a: a.state, b: b.state, alpha: (t - a.tick) / (b.tick - a.tick) };
      }
    }
    const last = this.snaps[n - 1]!.state;
    return { a: last, b: last, alpha: 0 };
  }
}

/**
 * The keys this client sent, and when (local ms). The server applies, at each
 * tick, the last keys it received; this lets the predictor replay the same
 * thing from the client's side.
 */
export class KeyTimeline {
  private entries: { at: number; keys: Keys }[] = [];

  record(at: number, keys: Keys) {
    this.entries.push({ at, keys });
    // Keep a few seconds, plus the entry in force at the start of them.
    while (this.entries.length > 1 && this.entries[1]!.at < at - 3000) this.entries.shift();
  }

  keysAt(t: number): Keys {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i]!.at <= t) return this.entries[i]!.keys;
    }
    return NO_KEYS;
  }

  clear() {
    this.entries = [];
  }
}

/**
 * Your car, predicted. From the latest server state (tick T, arrived at local
 * `baseAt`), the server will apply at tick T+i the keys you sent at local
 * time `baseAt − rtt + i·step` (they travel half a round trip each way). So
 * "now" is tick T + (now − baseAt + rtt)/step, and the car there is the
 * engine stepped that many times with those keys. Only your car is simulated
 * (cars don't collide with each other), and the steps are cached: each frame
 * only adds the ticks that became due.
 */
export class Predictor {
  private base: RaceState | null = null;
  private baseAt = 0;
  private me = "";
  /** Your car after 0, 1, 2… predicted ticks. */
  private cars: Car[] = [];
  /** The single-car state after the last predicted tick, where the next step continues. */
  private last: RaceState | null = null;
  private rttUsed = 0;

  /** Before the race's first server state there's nothing to predict from (the lights). */
  clear() {
    this.base = null;
    this.last = null;
    this.cars = [];
  }

  reset(base: RaceState, baseAt: number, me: string) {
    const car = base.cars.find((c) => c.id === me);
    this.base = base;
    this.baseAt = baseAt;
    this.me = me;
    // Just your car; other cars and the finishing order don't affect it.
    this.last = car ? { ...base, cars: [car], finished: [], events: [] } : null;
    this.cars = car ? [car] : [];
  }

  /** Where your car is at local time `now`, or null before the race has a state. */
  at(now: number, rtt: number, keysAt: (t: number) => Keys): Car | null {
    if (!this.base || !this.last) return null;
    if (rtt !== this.rttUsed) {
      // A new RTT changes which keys apply to which tick: start over from the base.
      this.rttUsed = rtt;
      this.reset(this.base, this.baseAt, this.me);
    }
    const ahead = Math.min(MAX_PREDICT_TICKS, Math.max(0, (now - this.baseAt + rtt) / STEP_MS));
    const whole = Math.floor(ahead);
    while (this.cars.length < whole + 2) {
      const i = this.cars.length; // producing tick T + i
      const keys = keysAt(this.baseAt - rtt + i * STEP_MS);
      this.last = stepRace(this.last!, track, { [this.me]: keys });
      this.cars.push(this.last.cars[0]!);
    }
    return interpolateCar(this.cars[whole], this.cars[whole + 1]!, ahead - whole);
  }
}

/**
 * Hides prediction corrections: when a new server state moves the predicted
 * car, the car keeps being drawn where it was and the difference fades out
 * over ~100 ms. A big jump (left the map, respawned) snaps instead.
 */
export class Smoother {
  private dx = 0;
  private dy = 0;
  private dr = 0;
  private lastShown: Car | null = null;
  private lastAt = 0;

  /** Call right after the prediction is re-based on a new server state. */
  correct(fresh: Car | null) {
    if (!fresh || !this.lastShown) return;
    const dx = this.lastShown.x - fresh.x;
    const dy = this.lastShown.y - fresh.y;
    if (Math.hypot(dx, dy) > 40) {
      this.dx = this.dy = this.dr = 0;
      return;
    }
    let dr = this.lastShown.rotation - fresh.rotation;
    if (dr > 180) dr -= 360;
    if (dr < -180) dr += 360;
    this.dx = dx;
    this.dy = dy;
    this.dr = dr;
  }

  /** The car to draw at `now`: the prediction plus what's left of the correction. */
  apply(car: Car, now: number): Car {
    const decay = Math.exp(-Math.max(0, now - this.lastAt) / 100);
    this.lastAt = now;
    this.dx *= decay;
    this.dy *= decay;
    this.dr *= decay;
    const shown = {
      ...car,
      x: car.x + this.dx,
      y: car.y + this.dy,
      rotation: car.rotation + this.dr,
    };
    this.lastShown = shown;
    return shown;
  }

  clear() {
    this.dx = this.dy = this.dr = 0;
    this.lastShown = null;
  }
}

/** Round trip to the server, smoothed (EWMA) so one slow reply doesn't jerk the prediction. */
export class Rtt {
  /** A sensible guess until the first pong: a same-continent round trip. */
  value = 100;
  private measured = false;

  sample(ms: number) {
    const clamped = Math.max(0, Math.min(500, ms));
    this.value = this.measured ? this.value * 0.8 + clamped * 0.2 : clamped;
    this.measured = true;
  }
}
