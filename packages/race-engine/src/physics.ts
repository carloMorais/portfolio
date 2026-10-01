import { PHYSICS, round2 } from "./constants.ts";
import type { Car, Keys } from "./types.ts";

const P = PHYSICS;
const rad = (deg: number) => (deg * Math.PI) / 180;
const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * Advances one car's controls by one tick: nitro, deceleration, steering and
 * acceleration, in the same order as the 2024 game. Moving (and bouncing off
 * walls) is `moveCar`. Mutates `car` (callers pass a copy; `stepRace` is pure
 * from the outside).
 */
export function stepCarPhysics(car: Car, keys: Keys, tick: number): void {
  // Nitro: expire, then fire if the key is held and a charge is available.
  if (car.nitroUntil !== null && tick >= car.nitroUntil) car.nitroUntil = null;
  if (keys.nitro && car.nitro > 0 && car.nitroUntil === null) {
    car.nitro -= 1;
    car.nitroUntil = tick + P.nitroTicks;
  }
  const boosted = car.nitroUntil !== null;
  const maxVelocity = boosted ? P.nitroMaxVelocity : P.maxVelocity;

  decelerate(car, keys, maxVelocity);
  steer(car, keys);
  accelerate(car, keys, boosted);
  clampVelocity(car, maxVelocity);
  // Fixed on purpose: the original snapped negative angles to 360 instead of wrapping.
  car.rotation = ((car.rotation % 360) + 360) % 360;

  car.vx = round2(car.vx);
  car.vy = round2(car.vy);
}

function decelerate(car: Car, keys: Keys, maxVelocity: number) {
  const coasting = !keys.up && !keys.down && !keys.left && !keys.right;
  if (!coasting) car.deceleration = P.baseDeceleration;
  // The original doubles while below the cap, so it can overshoot it once (0.08 → 0.16).
  else if (car.deceleration < P.maxDeceleration) car.deceleration += car.deceleration;

  const d = car.deceleration;
  // Speeds at the cap are left alone; everything below drifts back to zero.
  if (car.vy < 0 && car.vy > -maxVelocity) car.vy = Math.min(0, car.vy + d);
  else if (car.vy > 0 && car.vy < maxVelocity) car.vy = Math.max(0, car.vy - d);
  if (car.vx < 0 && car.vx > -maxVelocity) car.vx = Math.min(0, car.vx + d);
  else if (car.vx > 0 && car.vx < maxVelocity) car.vx = Math.max(0, car.vx - d);
}

function steer(car: Car, keys: Keys) {
  // Steering builds up with speed. Unlike the original, holding throttle or
  // brake lets a stopped car turn too, so it can always back off a wall.
  const driving = keys.up || keys.down;
  const speed = Math.max(
    Math.ceil(Math.abs(car.vx) + Math.abs(car.vy)),
    driving ? P.minSteerSpeed : 0,
  );
  if (keys.left || keys.right) car.align = null; // the driver's steering wins
  if (keys.left) {
    car.rotationSpeed = Math.max(-P.maxRotationSpeed, car.rotationSpeed - P.rotationStep * speed);
  } else if (keys.right) {
    car.rotationSpeed = Math.min(P.maxRotationSpeed, car.rotationSpeed + P.rotationStep * speed);
  }
  if (car.rotationSpeed > 0)
    car.rotationSpeed = Math.max(0, car.rotationSpeed - P.rotationFriction);
  if (car.rotationSpeed < 0)
    car.rotationSpeed = Math.min(0, car.rotationSpeed + P.rotationFriction);
  car.rotation += car.rotationSpeed;

  // After a glancing wall hit, ease the nose along the wall (see alignAfterBump).
  if (car.align !== null) {
    const diff = wrap180(car.align - car.rotation);
    if (Math.abs(diff) <= P.alignStep) {
      car.rotation = car.align;
      car.align = null;
    } else {
      car.rotation += Math.sign(diff) * P.alignStep;
    }
  }
}

function accelerate(car: Car, keys: Keys, boosted: boolean) {
  const acceleration = P.acceleration + (boosted ? P.nitroAcceleration : 0);
  const sin = Math.sin(rad(car.rotation));
  const cos = Math.cos(rad(car.rotation));
  if (keys.up) {
    car.vy -= acceleration * sin;
    car.vx -= acceleration * cos;
  }
  if (keys.down) {
    car.vy += acceleration * sin;
    car.vx += acceleration * cos;
  }
}

/** Each axis is capped on its own, as in the original. */
function clampVelocity(car: Car, maxVelocity: number) {
  car.vx = Math.max(-maxVelocity, Math.min(maxVelocity, car.vx));
  car.vy = Math.max(-maxVelocity, Math.min(maxVelocity, car.vy));
}

/** Barrels and logs pull each axis towards zero by `effect` (negative), never past it. */
export function applySlowdown(car: Car, effect: number): void {
  if (car.vx > 0) car.vx = Math.max(0, car.vx + effect);
  else if (car.vx < 0) car.vx = Math.min(0, car.vx - effect);
  if (car.vy > 0) car.vy = Math.max(0, car.vy + effect);
  else if (car.vy < 0) car.vy = Math.min(0, car.vy - effect);
}
