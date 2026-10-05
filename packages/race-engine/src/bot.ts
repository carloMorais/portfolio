import { PHYSICS } from "./constants.ts";
import type { Car, Keys, Track } from "./types.ts";

/**
 * How a bot drives. Lower `skill` keeps the throttle in sharper turns;
 * `topSpeed` (track pixels per tick) makes it lift off above that speed and
 * skip the nitro, which is what sets the difficulty. `racing` swaps in the
 * stronger driver of the hard bots (see `racingKeys`); there `topSpeed`
 * only caps the straights, and the nitro is still used. `fixed` keeps it
 * out of the rubber band (`elasticStyle`): hard bots stay honest.
 */
export type BotStyle = { skill: number; topSpeed?: number; racing?: boolean; fixed?: boolean };

const deg = (rad: number) => (rad * 180) / Math.PI;
const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * Keys for a bot heading to its next waypoint. Uses only what a player sees
 * (its own car and the track), so the same function drives practice bots in
 * the browser and filler bots on the server.
 */
export function botKeys(car: Car, track: Track, style: BotStyle = { skill: 1 }): Keys {
  if (style.racing) return racingKeys(car, track, style.topSpeed);
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

/*
 * The racing driver's tuning, found by a parameter search over full races
 * (05/10/2026). Braking for corners turned out not to pay: the cars carry
 * their momentum (steering only turns the nose; the throttle has to bend the
 * velocity), so what wins is pointing the throttle where the velocity should
 * go, cutting towards the next waypoint and steering round the obstacles.
 */
/** Distance (px) before a waypoint where the aim starts sliding towards the next one. */
const LOOK_AHEAD = 90;
/** How far towards the next waypoint the aim slides (share of the way, at most). */
const CUT = 0.18;
/** Obstacles further ahead than this (px) are ignored. */
const AVOID_RANGE = 150;
/** Obstacles closer than this (px) are ignored: too late to swerve, and the slide carries on anyway. */
const AVOID_LEAD = 30;
/** Extra gap (px) kept from an obstacle's side: the car slides, so aiming at the edge grazes it. */
const AVOID_MARGIN = 10;
/** Speed (px/tick) it aims for without nitro: a bit over `maxVelocity`, which caps each axis on its own. */
const CRUISE = 7.2;
/** Half-width (px) of the corridor that must be free of walls to aim through it. */
const CLEARANCE = 8;
/** Steering dead zone (degrees), after accounting for the spin the car already has. */
const STEER_TOLERANCE = 7.5;
/** Fire the nitro only with at least this much straight (px) to the next waypoint. */
const NITRO_RUN = 110;

/** True when a box of half-width `r` can slide from (x0, y0) to (x1, y1) without touching a wall. */
function clearPath(track: Track, x0: number, y0: number, x1: number, y1: number, r: number) {
  const [minX, maxX] = [Math.min(x0, x1) - r, Math.max(x0, x1) + r];
  const [minY, maxY] = [Math.min(y0, y1) - r, Math.max(y0, y1) + r];
  const walls = track.walls.filter(
    (w) => w.x < maxX && w.x + w.width > minX && w.y < maxY && w.y + w.height > minY,
  );
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
  for (let i = 1; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    for (const w of walls) {
      if (x + r > w.x && x - r < w.x + w.width && y + r > w.y && y - r < w.y + w.height)
        return false;
    }
  }
  return true;
}

/**
 * The hard bots' driver. Same information as `botKeys` (its own car and the
 * track; it doesn't know which items are picked up, so it steers round every
 * obstacle), but it drives like a player who knows the physics:
 * - aims a little past the waypoint it's reaching, towards the next one, when
 *   no wall is in the way;
 * - steers round an obstacle on its path, to the side with room;
 * - points the nose where the throttle fixes the velocity (desired minus
 *   current), not straight at the target, so it doesn't slide wide;
 * - lets go of the steering early when the car's spin will finish the turn;
 * - keeps the nitro for straights.
 * 2 laps: ~42–43 s uncapped (was ~51 s with `botKeys`).
 */
function racingKeys(car: Car, track: Track, topSpeed = Infinity): Keys {
  const points = track.waypoints;
  const n = points.length;
  const cur = points[car.waypoint] ?? points[0]!;
  const next = points[(car.waypoint + 1) % n]!;
  const cx = car.x + car.width / 2;
  const cy = car.y + car.height / 2;
  const toWaypoint = Math.hypot(cur.x - cx, cur.y - cy);

  const cut = Math.max(0, Math.min(1, 1 - (toWaypoint - 40) / LOOK_AHEAD)) * CUT;
  let ax = cur.x + (next.x - cur.x) * cut;
  let ay = cur.y + (next.y - cur.y) * cut;
  if (cut > 0 && !clearPath(track, cx, cy, ax, ay, CLEARANCE)) [ax, ay] = [cur.x, cur.y];
  // Knocked off the line with a wall between it and the waypoint: back to the
  // previous one, from where the waypoint is in sight again.
  const prev = points[(car.waypoint - 1 + n) % n]!;
  if (!clearPath(track, cx, cy, cur.x, cur.y, 1) && clearPath(track, cx, cy, prev.x, prev.y, 1))
    [ax, ay] = [prev.x, prev.y];
  let dist = Math.hypot(ax - cx, ay - cy) || 1;
  let [ux, uy] = [(ax - cx) / dist, (ay - cy) / dist];

  // The first obstacle on the way: aim beside it instead.
  // (Not while nearly stopped: then the plain waypoint is the way out.)
  for (const item of Math.hypot(car.vx, car.vy) < 1 ? [] : track.items) {
    if (item.type === 1) continue;
    const ix = item.x + item.width / 2 - cx;
    const iy = item.y + item.height / 2 - cy;
    const ahead = ix * ux + iy * uy - AVOID_LEAD;
    if (ahead < 0 || ahead > Math.min(dist + 30, AVOID_RANGE)) continue;
    const side = -ix * uy + iy * ux; // offset along the left normal (−uy, ux)
    const room = Math.max(item.width, item.height) / 2 + car.width / 2 + AVOID_MARGIN;
    if (Math.abs(side) >= room) continue;
    const away = side > 0 ? -1 : 1;
    for (const s of [away, -away]) {
      const px = cx + ix - uy * s * room;
      const py = cy + iy + ux * s * room;
      if (clearPath(track, cx, cy, px, py, CLEARANCE)) {
        [ax, ay] = [px, py];
        break;
      }
    }
    dist = Math.hypot(ax - cx, ay - cy) || 1;
    [ux, uy] = [(ax - cx) / dist, (ay - cy) / dist];
    break;
  }

  const boosted = car.nitroUntil !== null;
  const target = Math.min(boosted ? PHYSICS.nitroMaxVelocity : CRUISE, topSpeed);
  const speed = Math.hypot(car.vx, car.vy);
  const tooFast = speed > target + 0.3;
  // Throttle pushes along the nose, so point it at the velocity change wanted.
  const heading = tooFast
    ? deg(Math.atan2(uy, ux))
    : deg(Math.atan2(uy * target - car.vy, ux * target - car.vx));
  const error = wrap180(heading - (car.rotation + 180));
  // How much further the nose turns by itself as the spin dies down.
  let drift = 0;
  for (let r = Math.abs(car.rotationSpeed); r > 0; r -= PHYSICS.rotationFriction) drift += r;
  const steer = error - Math.sign(car.rotationSpeed) * drift;

  return {
    left: steer < -STEER_TOLERANCE,
    right: steer > STEER_TOLERANCE,
    up: !tooFast && (Math.abs(error) < 100 || speed < 1),
    down: tooFast,
    nitro: !boosted && car.nitro > 0 && Math.abs(error) < 10 && speed > 4 && toWaypoint > NITRO_RUN,
  };
}

export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Three bot styles per difficulty, shared by practice mode and the online
 * server. Measured over 2 laps (05/10/2026, with the obstacle penalty by kind
 * and the two nitros behind barrels): easy ~69–76 s, normal ~50–63 s
 * (average ~56), hard ~42–49 s, without the rubber band. Hard and normal
 * both use the racing driver (hard was ~53–55 s with `botKeys` until a
 * player beat them by 7 s); normal only with a lower top speed. Normal used
 * `botKeys` too (~59–65 s), far from hard, and on a 10-car grid some of
 * those got stuck and never finished.
 */
export const BOT_STYLES: Record<Difficulty, BotStyle[]> = {
  easy: [
    { skill: 1, topSpeed: 4 },
    { skill: 1, topSpeed: 3.75 },
    { skill: 1, topSpeed: 3.5 },
  ],
  normal: [
    { skill: 1, racing: true, topSpeed: 5.8 },
    { skill: 1, racing: true, topSpeed: 5.5 },
    { skill: 1, racing: true, topSpeed: 5.2 },
  ],
  hard: [
    { skill: 1, racing: true, fixed: true },
    { skill: 1, racing: true, fixed: true, topSpeed: 6.4 },
    { skill: 1, racing: true, fixed: true, topSpeed: 6.1 },
  ],
};

/** The elastic's range: a bot far ahead drives up to 15% slower, one far behind up to 12% faster. */
const ELASTIC_MIN = 0.85;
const ELASTIC_MAX = 1.12;
/** How strongly the gap (share of the race, 0–1) bends the top speed. */
const ELASTIC_GAIN = 2.5;
/** The fastest the rubber band ever lets a bot go (the slowest hard bot's straights: 6.1). */
const ELASTIC_TOP = 6;

/**
 * A light rubber band for the capped difficulties (easy, normal): a bot
 * well ahead of the leading human eases off, one well behind pushes a
 * little, so the pack stays together and an early mistake doesn't decide the
 * race. Hard bots (`fixed`) are left alone, so "hard" stays honest.
 * `gap` is the bot's race progress minus the leading human's (see
 * `raceProgress`); positive when the bot is ahead.
 */
export function elasticStyle(style: BotStyle, gap: number): BotStyle {
  if (style.fixed || style.topSpeed === undefined) return style;
  const factor = Math.max(ELASTIC_MIN, Math.min(ELASTIC_MAX, 1 - gap * ELASTIC_GAIN));
  // Never as fast as the hard bots' straights.
  return { ...style, topSpeed: Math.min(ELASTIC_TOP, style.topSpeed * factor) };
}
