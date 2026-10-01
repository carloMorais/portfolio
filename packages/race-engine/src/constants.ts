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
  wallBounce: 0.4,
  /** Degrees per tick the nose turns towards the wall it's sliding along. Not in the original. */
  alignStep: 4,
  /**
   * With throttle or brake held, steering works as if the car were at least
   * this fast, so a car stopped against a wall can always turn away. Not in the original.
   */
  minSteerSpeed: 3,
} as const;

/** Rounds to 2 decimals like the original, so client and server stay in sync. */
export const round2 = (n: number) => Math.round(n * 100) / 100;
