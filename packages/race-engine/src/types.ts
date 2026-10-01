/** Axis-aligned box in track pixels (origin top-left, y grows down). */
export type Box = { x: number; y: number; width: number; height: number };

/** Keys held by a driver during one tick. */
export type Keys = { up: boolean; down: boolean; left: boolean; right: boolean; nitro: boolean };

export const NO_KEYS: Keys = { up: false, down: false, left: false, right: false, nitro: false };

/** 1 = nitro (stored, used with the nitro key); 2 = barrel and 3 = log slow you down on contact. */
export type ItemType = 1 | 2 | 3;

export type ItemSpawn = Box & { id: string; type: ItemType };

export type Checkpoint = Box & { order: number };

export type Track = {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  walls: Box[];
  /** Must be crossed in `order` (1, 2, …) before the finish line counts a lap. */
  checkpoints: Checkpoint[];
  finishLine: Box;
  items: ItemSpawn[];
  /** Racing line for bots: centres of the points to drive through, in order, looping. */
  waypoints: { x: number; y: number }[];
};

export type Car = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees. At 0 the car faces left (−x); turning right increases it. */
  rotation: number;
  rotationSpeed: number;
  vx: number;
  vy: number;
  /** Grows while no key is held, so a coasting car slows down faster and faster. */
  deceleration: number;
  /** Last checkpoint crossed in this lap (0 = none yet). */
  checkpoint: number;
  laps: number;
  /** Nitro charges collected (at most `maxNitro`). */
  nitro: number;
  /** Tick until which nitro is active, or null. */
  nitroUntil: number | null;
  /** Rotation the car is easing towards after a glancing wall hit, or null. */
  align: number | null;
  /** Index into `track.waypoints` the bot is heading to (also handy for placement). */
  waypoint: number;
  finishedAt: number | null;
  /** Ticks each completed lap took, in order. */
  lapTicks: number[];
  /** Tick the current lap started. */
  lapStartedAt: number;
};

/**
 * What happened during the last tick, for effects and announcements. Not
 * needed to run the race: each tick starts with an empty list.
 */
export type RaceEvent =
  /** Bounced off something. `impact` is the speed into it; `nx`/`ny` the direction it was going. `gate`: an out-of-order checkpoint or the closed finish line (wrong way). */
  | { type: "bump"; car: string; impact: number; nx: -1 | 0 | 1; ny: -1 | 0 | 1; gate: boolean }
  | { type: "pickup"; car: string; item: string; itemType: ItemType }
  /** Completed lap number `lap` in `ticks`; `finished` on the last one. */
  | { type: "lap"; car: string; lap: number; ticks: number; finished: boolean };

export type RaceState = {
  tick: number;
  laps: number;
  cars: Car[];
  /** Ticks at which each picked item comes back (absent = on the track). */
  itemRespawnAt: Record<string, number>;
  /** Car ids in finishing order. */
  finished: string[];
  events: RaceEvent[];
};
