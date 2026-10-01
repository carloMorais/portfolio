import { round2 } from "./constants.ts";
import type { Box, Car } from "./types.ts";

/** Axis-aligned overlap test (the car is treated as its bounding box, as in 2024). */
export const overlaps = (car: Box, box: Box) =>
  car.x + car.width > box.x &&
  car.x < box.x + box.width &&
  car.y + car.height > box.y &&
  car.y < box.y + box.height;

/**
 * Pushes `car` out of `box` against its direction of travel and bounces it,
 * ported from the 2024 CollisionDetector. When it hits a corner, it is moved
 * out along whichever side it would have crossed first.
 */
export function resolveCollision(
  car: Car,
  box: Box,
  resetVelocity: boolean,
  multipleHits: boolean,
): void {
  const left = box.x;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height;
  const { vx, vy } = car;

  // The way out is opposite to the velocity.
  const escapeRight = vx < 0 ? right : undefined;
  const escapeLeft = vx > 0 ? left : undefined;
  const escapeDown = vy < 0 ? bottom : undefined;
  const escapeUp = vy > 0 ? top : undefined;

  if (escapeUp !== undefined || escapeDown !== undefined) {
    const up = escapeUp !== undefined;
    const deltaY = up ? car.y + car.height - escapeUp! : escapeDown! - car.y;
    const ySign = up ? -1 : 1;
    if (escapeLeft !== undefined) {
      diagonal(car, car.x + car.width - escapeLeft, deltaY, ySign, -1, resetVelocity, multipleHits);
    } else if (escapeRight !== undefined) {
      diagonal(car, escapeRight - car.x, deltaY, ySign, 1, resetVelocity, multipleHits);
    } else {
      car.y += deltaY * ySign;
      if (resetVelocity) car.vy = (Math.abs(car.vy) / 2) * ySign;
    }
  } else if (escapeLeft !== undefined) {
    car.x -= car.x + car.width - escapeLeft;
    if (resetVelocity) car.vx = (Math.abs(car.vx) / 2) * -1;
  } else if (escapeRight !== undefined) {
    car.x += escapeRight - car.x;
    if (resetVelocity) car.vx = Math.abs(car.vx) / 2;
  }

  car.vx = round2(car.vx);
  car.vy = round2(car.vy);
  car.x = round2(car.x);
  car.y = round2(car.y);
}

function diagonal(
  car: Car,
  deltaX: number,
  deltaY: number,
  ySign: number,
  xSign: number,
  resetVelocity: boolean,
  multipleHits: boolean,
) {
  const ax = Math.abs(car.vx);
  const ay = Math.abs(car.vy);
  const xFirst = Math.abs(deltaX) / ax < Math.abs(deltaY) / ay;

  if (xFirst) {
    car.x += deltaX * xSign;
    car.y += ((deltaX * ay) / ax) * ySign;
    if (resetVelocity) {
      car.vy = multipleHits ? 0 : car.vy * 0.93;
      car.y += car.vy;
      car.vx = car.vx * 0.2 * -1;
    }
  } else {
    car.x += ((deltaY * ax) / ay) * xSign;
    car.y += deltaY * ySign;
    if (resetVelocity) {
      car.vx = multipleHits ? 0 : car.vx * 0.93;
      car.x += car.vx;
      car.vy = car.vy * 0.2 * -1;
    }
  }
}
