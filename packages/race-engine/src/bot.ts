import type { Car, Keys, Track } from "./types.ts";

/**
 * How a bot drives. Lower `skill` keeps the throttle in sharper turns;
 * `topSpeed` (track pixels per tick) makes it lift off above that speed and
 * skip the nitro, which is what sets the difficulty.
 */
export type BotStyle = { skill: number; topSpeed?: number };

const deg = (rad: number) => (rad * 180) / Math.PI;
const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * Keys for a bot heading to its next waypoint. Uses only what a player sees
 * (its own car and the track), so the same function drives practice bots in
 * the browser and filler bots on the server.
 */
export function botKeys(car: Car, track: Track, style: BotStyle = { skill: 1 }): Keys {
  const target = track.waypoints[car.waypoint] ?? track.waypoints[0]!;
  const dx = target.x - (car.x + car.width / 2);
  const dy = target.y - (car.y + car.height / 2);

  // At rotation r the car moves along (−cos r, −sin r), i.e. it faces r + 180°.
  const facing = car.rotation + 180;
  const turn = wrap180(deg(Math.atan2(dy, dx)) - facing);
  const speed = Math.hypot(car.vx, car.vy);

  const tolerance = 6;
  const sharp = 50 / style.skill;
  return {
    left: turn < -tolerance,
    right: turn > tolerance,
    // Lift off in sharp turns, brake if they come in too fast.
    up: (Math.abs(turn) < sharp || speed < 2) && speed < (style.topSpeed ?? Infinity),
    down: Math.abs(turn) > 2 * sharp && speed > 3,
    nitro: style.topSpeed === undefined && car.nitro > 0 && Math.abs(turn) < 10 && speed > 4,
  };
}

export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Three bot styles per difficulty, shared by practice mode and the online
 * server. Measured over 2 laps: easy ~68–76 s, normal ~58–64 s, hard ~50 s
 * (no speed cap, and they use nitro).
 */
export const BOT_STYLES: Record<Difficulty, BotStyle[]> = {
  easy: [
    { skill: 1, topSpeed: 4 },
    { skill: 1, topSpeed: 3.75 },
    { skill: 1, topSpeed: 3.5 },
  ],
  normal: [
    { skill: 1, topSpeed: 5.5 },
    { skill: 1, topSpeed: 5 },
    { skill: 1, topSpeed: 4.5 },
  ],
  hard: [{ skill: 1 }, { skill: 0.9 }, { skill: 0.8 }],
};
