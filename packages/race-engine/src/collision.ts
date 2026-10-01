import { PHYSICS, round2 } from "./constants.ts";
import type { Box, Car } from "./types.ts";

/** Axis-aligned overlap test (the car is treated as its bounding box). */
export const overlaps = (car: Box, box: Box) =>
  car.x + car.width > box.x &&
  car.x < box.x + box.width &&
  car.y + car.height > box.y &&
  car.y < box.y + box.height;

/** Which axes hit something during the last move. */
export type Bump = { x: boolean; y: boolean };

/**
 * Moves the car by its velocity like a box bouncing off walls: first along x,
 * then along y. Hitting something on an axis puts the car flush against it and
 * reverses that axis's speed with a loss (`wallBounce`); the other axis keeps
 * its speed. With X=5, Y=5 hitting a ceiling you get X=5, Y=−2.
 *
 * Replaces the 2024 corner-escape logic, which could pin a car in stepped
 * corners or tunnel it through thin walls. The car starts each move outside
 * every blocker and never moves more than a wall's thickness, so it can't end
 * up inside one.
 */
export function moveCar(car: Car, blockers: Box[]): Bump {
  // Something the car already overlaps (e.g. it was just made solid) can't trap it.
  const solid = blockers.filter((box) => !overlaps(car, box));
  const bump: Bump = { x: false, y: false };

  car.x += car.vx;
  const hitX = solid.filter((box) => overlaps(car, box));
  if (hitX.length > 0) {
    car.x =
      car.vx > 0
        ? Math.min(...hitX.map((b) => b.x)) - car.width
        : Math.max(...hitX.map((b) => b.x + b.width));
    car.vx = -car.vx * PHYSICS.wallBounce;
    bump.x = true;
  }

  car.y += car.vy;
  const hitY = solid.filter((box) => overlaps(car, box));
  if (hitY.length > 0) {
    car.y =
      car.vy > 0
        ? Math.min(...hitY.map((b) => b.y)) - car.height
        : Math.max(...hitY.map((b) => b.y + b.height));
    car.vy = -car.vy * PHYSICS.wallBounce;
    bump.y = true;
  }

  car.x = round2(car.x);
  car.y = round2(car.y);
  car.vx = round2(car.vx);
  car.vy = round2(car.vy);
  return bump;
}

/**
 * After a glancing hit, aim the car along the wall it's sliding on: hitting a
 * side wall while moving down turns the nose down, hitting a ceiling while
 * moving right turns it right. Only when the car already points roughly that
 * way (a head-on hit just bounces) and is still moving along the wall.
 */
export function alignAfterBump(car: Car, bump: Bump): void {
  if (bump.x === bump.y) return; // no hit, or a corner
  const along = bump.x ? car.vy : car.vx;
  if (Math.abs(along) < 1) return;
  // Facing angles in screen space (y down): 0 = right, 90 = down.
  const facingTarget = bump.x ? (along > 0 ? 90 : 270) : along > 0 ? 0 : 180;
  const facing = car.rotation + 180;
  const diff = ((((facingTarget - facing + 180) % 360) + 360) % 360) - 180;
  if (Math.abs(diff) >= 90) return;
  car.align = (((facingTarget - 180) % 360) + 360) % 360;
}
