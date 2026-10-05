import type { ItemType } from "./types.ts";

/** Server ticks per second, as in the 2024 game. */
export const TICK_RATE = 30;

/**
 * Physics tuned in the original game (backend/src/game/controller/carController.ts).
 * Durations that were milliseconds there are ticks here, so the simulation is
 * deterministic: the same inputs always give the same race.
 */
export const PHYSICS = {
  carSize: 25,
  maxVelocity: 6,
  acceleration: 0.2,
  /** Deceleration while a key is held. */
  baseDeceleration: 0.01,
  /** A coasting car starts here and doubles each tick while below `maxDeceleration`. */
  initialDeceleration: 0.04,
  maxDeceleration: 0.09,
  maxNitro: 3,
  nitroAcceleration: 0.1,
  nitroMaxVelocity: 8,
  /** 2500 ms at 30 ticks/s. */
  nitroTicks: 75,
  rotationStep: 0.5,
  maxRotationSpeed: 6,
  rotationFriction: 0.5,
  /** 3000 ms at 30 ticks/s. */
  itemRespawnTicks: 90,
  /** Share of an axis's speed kept (and reversed) when it hits a wall. Not in the original. */
  wallBounce: 0.25,
  /** Degrees per tick the nose turns towards the wall it's sliding along. Not in the original. */
  alignStep: 2,
  /**
   * With throttle or brake held, steering works as if the car were at least
   * this fast, so a car stopped against a wall can always turn away. Not in the original.
   */
  minSteerSpeed: 3,
} as const;

/** Rounds to 2 decimals like the original, so client and server stay in sync. */
export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What each item is. `penalty` is the share of the speed an obstacle costs,
 * on both axes (not in the original, which took a fixed 5). Until 05/10/2026
 * every obstacle cost 70%: one touch decided a ~30 s lap. Now it follows what
 * the thing is: a cone gives way (25%), a barrel less so (45%), a log is the
 * worst (55%). `rigid` tells clients how to show the hit: rigid things
 * shatter, soft ones just burst.
 */
export const ITEM_KINDS: Record<
  ItemType,
  { name: "nitro" | "barrel" | "log" | "cone"; rigid: boolean; penalty: number }
> = {
  1: { name: "nitro", rigid: false, penalty: 0 },
  2: { name: "barrel", rigid: true, penalty: 0.45 },
  3: { name: "log", rigid: true, penalty: 0.55 },
  4: { name: "cone", rigid: false, penalty: 0.25 },
};

/**
 * How many car colours there are to pick from (as many as a room's seats, so
 * no two cars ever share one). Only the index travels: the colours themselves
 * are the client's (apps/web's race/colors.ts).
 */
export const CAR_COLOR_COUNT = 10;
