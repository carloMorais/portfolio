import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { overlaps, resolveCollision } from "./collision.ts";
import { createCar } from "./race.ts";

const wall = { x: 100, y: 0, width: 20, height: 200 };

describe("overlaps", () => {
  test("touching edges is not a collision", () => {
    assert.equal(overlaps(createCar("a", 75, 50), wall), false);
    assert.equal(overlaps(createCar("a", 76, 50), wall), true);
  });
});

describe("resolveCollision", () => {
  test("a car driving right into a wall is pushed back out and bounces at half speed", () => {
    const car = createCar("a", 80, 50); // right edge at 105, 5 px into the wall
    car.vx = 4;
    resolveCollision(car, wall, true, false);
    assert.equal(car.x + car.width, wall.x);
    assert.equal(car.vx, -2);
    assert.equal(overlaps(car, wall), false);
  });

  test("a car driving down into a floor is pushed up", () => {
    const floor = { x: 0, y: 100, width: 500, height: 20 };
    const car = createCar("a", 50, 80);
    car.vy = 3;
    resolveCollision(car, floor, true, false);
    assert.equal(car.y + car.height, floor.y);
    assert.equal(car.vy, -1.5);
  });

  test("hitting a corner, the car leaves through the side it would have crossed first", () => {
    const box = { x: 100, y: 100, width: 50, height: 50 };
    const car = createCar("a", 78, 120); // 3 px in from the left, 45 px in from the top
    car.vx = 3;
    car.vy = 3;
    resolveCollision(car, box, false, false);
    assert.equal(car.x + car.width, box.x);
  });
});
