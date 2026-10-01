import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { alignAfterBump, moveCar, overlaps } from "./collision.ts";
import { createCar } from "./race.ts";
import { classicTrack } from "./track.ts";

const wall = { x: 100, y: 0, width: 20, height: 200 };
const ceiling = { x: 0, y: 0, width: 500, height: 20 };

describe("overlaps", () => {
  test("touching edges is not a collision", () => {
    assert.equal(overlaps(createCar("a", 75, 50), wall), false);
    assert.equal(overlaps(createCar("a", 76, 50), wall), true);
  });
});

describe("moveCar", () => {
  test("hitting a ceiling reverses only y, keeping a quarter of it: X=5, Y=−4 → X=5, Y=1", () => {
    const car = createCar("a", 50, 22);
    car.vx = 5;
    car.vy = -4;
    const bump = moveCar(car, [ceiling]);
    assert.deepEqual([bump.x, bump.y, bump.impact, bump.ny], [false, true, 4, -1]);
    assert.deepEqual(bump.hits, [ceiling]);
    assert.equal(car.vx, 5);
    assert.equal(car.vy, 1);
    assert.equal(car.y, ceiling.height); // flush against it
  });

  test("hitting a side wall puts the car flush and bounces x", () => {
    const car = createCar("a", 72, 50);
    car.vx = 4;
    const bump = moveCar(car, [wall]);
    assert.deepEqual([bump.x, bump.y, bump.impact, bump.nx], [true, false, 4, 1]);
    assert.equal(car.x + car.width, wall.x);
    assert.equal(car.vx, -1);
  });

  test("a blocker the car already overlaps doesn't trap it", () => {
    const car = createCar("a", 90, 50); // already inside the wall
    car.vx = -3;
    moveCar(car, [wall]);
    assert.equal(car.x, 87);
  });

  test("never ends a move inside a track wall, whatever the speed and heading", () => {
    // Deterministic pseudo-random sweep over the real track.
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    let moves = 0;
    while (moves < 5000) {
      const car = createCar("a", rand() * 735, rand() * 575);
      if (classicTrack.walls.some((w) => overlaps(car, w))) continue;
      car.vx = (rand() * 2 - 1) * 8;
      car.vy = (rand() * 2 - 1) * 8;
      moveCar(car, classicTrack.walls);
      const inside = classicTrack.walls.find((w) => overlaps(car, w));
      assert.equal(inside, undefined, `inside ${JSON.stringify(inside)} at ${car.x},${car.y}`);
      moves++;
    }
  });
});

describe("alignAfterBump", () => {
  test("sliding down a side wall turns the nose down", () => {
    const car = createCar("a", 0, 0);
    car.rotation = 225; // facing 45°: down and to the right
    car.vy = 4; // still moving down after bouncing off the right wall
    alignAfterBump(car, { x: true, y: false });
    assert.equal(car.align, 270); // facing 90° = straight down
  });

  test("a head-on hit just bounces, without turning the car", () => {
    const car = createCar("a", 0, 0);
    car.rotation = 180; // facing right
    car.vy = 0.3;
    alignAfterBump(car, { x: true, y: false });
    assert.equal(car.align, null);
  });

  test("a car pointing away from the slide direction isn't turned around", () => {
    const car = createCar("a", 0, 0);
    car.rotation = 45; // facing 225°: up and to the left
    car.vy = 4; // but sliding down
    alignAfterBump(car, { x: true, y: false });
    assert.equal(car.align, null);
  });
});
