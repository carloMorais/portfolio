import type { Car, Keys, Track } from "./types.ts";

/** How a bot drives. Lower `skill` brakes earlier and turns later. */
export type BotStyle = { skill: number };

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
    up: Math.abs(turn) < sharp || speed < 2,
    down: Math.abs(turn) > 2 * sharp && speed > 3,
    nitro: car.nitro > 0 && Math.abs(turn) < 10 && speed > 4,
  };
}
