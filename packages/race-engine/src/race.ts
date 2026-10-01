import { PHYSICS, round2 } from "./constants.ts";
import { alignAfterBump, moveCar, overlaps } from "./collision.ts";
import { applySlowdown, stepCarPhysics } from "./physics.ts";
import { NO_KEYS, type Box, type Car, type Keys, type RaceState, type Track } from "./types.ts";

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
    align: null,
    waypoint: 0,
    finishedAt: null,
    lapTicks: [],
    lapStartedAt: 0,
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
    events: [],
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
  next.events = [];
  const tick = next.tick;

  for (const [id, at] of Object.entries(next.itemRespawnAt)) {
    if (at <= tick) delete next.itemRespawnAt[id];
  }

  for (const car of next.cars) {
    const keys = car.finishedAt === null ? (inputs[car.id] ?? NO_KEYS) : NO_KEYS;
    stepCarPhysics(car, keys, tick);
    const bump = moveCar(car, blockersFor(car, track));
    alignAfterBump(car, bump);
    if (bump.hits.length > 0) {
      next.events.push({
        type: "bump",
        car: car.id,
        impact: round2(bump.impact),
        nx: bump.nx,
        ny: bump.ny,
        gate: bump.hits.every((box) => !track.walls.includes(box)),
      });
    }
    keepInside(car, track);
  }
  for (const car of next.cars) crossCheckpoints(car, track);
  for (const car of next.cars) crossFinishLine(car, track, next);
  for (const car of next.cars) pickItems(car, track, next);
  for (const car of next.cars) followWaypoints(car, track);

  return next;
}

/**
 * What this car bounces off: the walls, any checkpoint out of order (no
 * shortcuts, no driving backwards) and the finish line unless the lap is
 * complete or hasn't started.
 */
function blockersFor(car: Car, track: Track): Box[] {
  const checkpoints = track.checkpoints.filter(
    (cp) => car.checkpoint !== cp.order - 1 && car.checkpoint !== cp.order,
  );
  const lineOpen = car.checkpoint === 0 || car.checkpoint === track.checkpoints.length;
  return [...track.walls, ...checkpoints, ...(lineOpen ? [] : [track.finishLine])];
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

/** Checkpoints count only in order (out-of-order ones are solid, see blockersFor). */
function crossCheckpoints(car: Car, track: Track) {
  const box = track.checkpoints.find((cp) => overlaps(car, cp));
  if (box && car.checkpoint === box.order - 1) car.checkpoint += 1;
}

function crossFinishLine(car: Car, track: Track, state: RaceState) {
  if (!overlaps(car, track.finishLine) || car.checkpoint !== track.checkpoints.length) return;
  car.checkpoint = 0;
  car.laps += 1;
  const ticks = state.tick - car.lapStartedAt;
  car.lapTicks.push(ticks);
  car.lapStartedAt = state.tick;
  const finished = car.laps >= state.laps && car.finishedAt === null;
  if (finished) {
    car.finishedAt = state.tick;
    state.finished.push(car.id);
  }
  state.events.push({ type: "lap", car: car.id, lap: car.laps, ticks, finished });
}

function pickItems(car: Car, track: Track, state: RaceState) {
  const item = activeItems(track, state).find((it) => overlaps(car, it));
  if (!item) return;
  if (item.type === 1) {
    if (car.nitro >= PHYSICS.maxNitro) return; // full: the nitro stays on the track
    car.nitro += 1;
  } else {
    applySlowdown(car);
  }
  state.itemRespawnAt[item.id] = state.tick + PHYSICS.itemRespawnTicks;
  state.events.push({ type: "pickup", car: car.id, item: item.id, itemType: item.type });
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

/**
 * True when the car is driving against the racing line: moving with some
 * speed, mostly opposite to the stretch it should be on. A bounce flips the
 * velocity for a moment, so callers should wait for it to last a little.
 */
export function wrongWay(car: Car, track: Track): boolean {
  const n = track.waypoints.length;
  const to = track.waypoints[car.waypoint];
  const from = track.waypoints[(car.waypoint - 1 + n) % n];
  if (!to || !from) return false;
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < 1.5) return false;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const along = (car.vx * dx + car.vy * dy) / (speed * Math.hypot(dx, dy));
  return along < -0.5;
}
