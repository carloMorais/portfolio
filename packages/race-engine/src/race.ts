import { PHYSICS } from "./constants.ts";
import { overlaps, resolveCollision } from "./collision.ts";
import { applySlowdown, stepCarPhysics } from "./physics.ts";
import { NO_KEYS, type Car, type Keys, type RaceState, type Track } from "./types.ts";

/**
 * Starting grid: the gap between the finish line (ends at x 367) and
 * checkpoint 5 (starts at x 420) fits two columns, three rows deep. A car
 * placed on checkpoint 5 would bounce off it, so cars beyond six share slots
 * (cars don't collide with each other, as in the original).
 */
const GRID_X = [368, 394];
const GRID_Y = [512, 533, 554];

export function gridPosition(_track: Track, index: number) {
  return { x: GRID_X[index % 2]!, y: GRID_Y[Math.floor(index / 2) % GRID_Y.length]! };
}

export function createCar(id: string, x: number, y: number): Car {
  return {
    id,
    x,
    y,
    width: PHYSICS.carSize,
    height: PHYSICS.carSize,
    rotation: 0,
    rotationSpeed: 0,
    vx: 0,
    vy: 0,
    deceleration: PHYSICS.initialDeceleration,
    checkpoint: 0,
    laps: 0,
    nitro: 0,
    nitroUntil: null,
    waypoint: 0,
    finishedAt: null,
  };
}

export function createRace(track: Track, carIds: string[], laps = 3): RaceState {
  return {
    tick: 0,
    laps,
    cars: carIds.map((id, i) => {
      const { x, y } = gridPosition(track, i);
      return createCar(id, x, y);
    }),
    itemRespawnAt: {},
    finished: [],
  };
}

/** Items on the track at `tick` (picked ones come back after `itemRespawnTicks`). */
export const activeItems = (track: Track, state: RaceState) =>
  track.items.filter((item) => !(item.id in state.itemRespawnAt));

/**
 * One server tick: every car moves with the keys it holds (finished cars
 * coast), then walls, checkpoints, the finish line and items are applied.
 * Pure: returns a new state. Same inputs, same race.
 */
export function stepRace(state: RaceState, track: Track, inputs: Record<string, Keys>): RaceState {
  const next = structuredClone(state);
  next.tick += 1;
  const tick = next.tick;

  for (const [id, at] of Object.entries(next.itemRespawnAt)) {
    if (at <= tick) delete next.itemRespawnAt[id];
  }

  for (const car of next.cars) {
    const keys = car.finishedAt === null ? (inputs[car.id] ?? NO_KEYS) : NO_KEYS;
    const before = { x: car.x, y: car.y };
    stepCarPhysics(car, keys, tick);
    hitWalls(car, track, before);
    keepInside(car, track);
  }
  for (const car of next.cars) crossCheckpoints(car, track);
  for (const car of next.cars) crossFinishLine(car, track, next);
  for (const car of next.cars) pickItems(car, track, next);
  for (const car of next.cars) followWaypoints(car, track);

  return next;
}

function hitWalls(car: Car, track: Track, before: { x: number; y: number }) {
  const hits = track.walls.filter((wall) => overlaps(car, wall));
  if (hits.length === 1) resolveCollision(car, hits[0]!, true, false);
  // Several walls at once (a corner): only the last push resets the speed.
  // Fixed from the original: a wall the car already left is skipped. Resolving
  // it anyway pushed the car back into the previous wall, and on the next tick
  // the car escaped through the far side of it (tunnelling).
  else
    hits.forEach((wall, i) => {
      const last = i === hits.length - 1;
      if (overlaps(car, wall)) resolveCollision(car, wall, last, last);
    });
  // Safety net: never end a tick inside a wall. Go back to the last valid spot.
  if (track.walls.some((wall) => overlaps(car, wall))) {
    car.x = before.x;
    car.y = before.y;
    car.vx = 0;
    car.vy = 0;
  }
}

/** Leaving the map sends the car back to the start, as in the original. */
function keepInside(car: Car, track: Track) {
  const outside =
    car.x < 0 || car.x + car.width > track.width || car.y < 0 || car.y + car.height > track.height;
  if (!outside) return;
  car.x = track.spawn.x;
  car.y = track.spawn.y;
  car.vx = 0;
  car.vy = 0;
  car.checkpoint = 0;
  car.waypoint = 0;
}

/** Checkpoints count only in order; one out of order acts as a wall (no shortcuts, no reversing). */
function crossCheckpoints(car: Car, track: Track) {
  const box = track.checkpoints.find((cp) => overlaps(car, cp));
  if (!box) return;
  if (car.checkpoint === box.order - 1) car.checkpoint += 1;
  else if (car.checkpoint !== box.order) resolveCollision(car, box, true, false);
}

function crossFinishLine(car: Car, track: Track, state: RaceState) {
  if (!overlaps(car, track.finishLine)) return;
  if (car.checkpoint === track.checkpoints.length) {
    car.checkpoint = 0;
    car.laps += 1;
    if (car.laps >= state.laps && car.finishedAt === null) {
      car.finishedAt = state.tick;
      state.finished.push(car.id);
    }
  } else if (car.checkpoint !== 0) {
    resolveCollision(car, track.finishLine, true, false);
  }
}

function pickItems(car: Car, track: Track, state: RaceState) {
  const item = activeItems(track, state).find((it) => overlaps(car, it));
  if (!item) return;
  if (item.type === 1) {
    if (car.nitro >= PHYSICS.maxNitro) return; // full: the nitro stays on the track
    car.nitro += 1;
  } else {
    applySlowdown(car, item.velocityEffect);
  }
  state.itemRespawnAt[item.id] = state.tick + PHYSICS.itemRespawnTicks;
}

const WAYPOINT_RADIUS = 40;

function followWaypoints(car: Car, track: Track) {
  const target = track.waypoints[car.waypoint];
  if (!target) return;
  const dx = target.x - (car.x + car.width / 2);
  const dy = target.y - (car.y + car.height / 2);
  if (Math.hypot(dx, dy) < WAYPOINT_RADIUS) {
    car.waypoint = (car.waypoint + 1) % track.waypoints.length;
  }
}

/**
 * Race order: laps, then checkpoints, then progress along the racing line.
 * Finished cars keep their finishing order at the top.
 */
export function standings(state: RaceState, track: Track): Car[] {
  const n = track.waypoints.length;
  const progress = (car: Car) => {
    if (car.finishedAt !== null) return Number.MAX_SAFE_INTEGER - state.finished.indexOf(car.id);
    // Waypoint 0 sits just past the finish line: a car heading to it with every
    // checkpoint done is about to complete the lap, not at its start.
    const aboutToFinish = car.waypoint === 0 && car.checkpoint === track.checkpoints.length;
    return car.laps * n + (aboutToFinish ? n : car.waypoint);
  };
  return [...state.cars].sort((a, b) => progress(b) - progress(a));
}
