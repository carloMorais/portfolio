import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PHYSICS } from "./constants.ts";
import { applySlowdown, stepCarPhysics } from "./physics.ts";
import { createCar } from "./race.ts";
import { NO_KEYS, type Keys } from "./types.ts";

const keys = (k: Partial<Keys>): Keys => ({ ...NO_KEYS, ...k });

function drive(k: Partial<Keys>, ticks: number, car = createCar("a", 300, 300)) {
  for (let t = 1; t <= ticks; t++) stepCarPhysics(car, keys(k), t);
  return car;
}

describe("stepCarPhysics", () => {
  test("a parked car can't turn: steering needs speed", () => {
    const car = drive({ left: true }, 10);
    assert.equal(car.rotation, 0);
  });

  test("at rotation 0 the throttle pushes the car left (moving is moveCar's job)", () => {
    const car = drive({ up: true }, 5);
    assert.ok(car.vx < 0);
    assert.equal(car.vy, 0);
    assert.equal(car.x, 300);
  });

  test("with the throttle held, a stopped car can still turn (to back off a wall)", () => {
    const car = drive({ up: true, right: true }, 1);
    assert.ok(car.rotation > 0);
  });

  test("steering cancels an ongoing wall alignment", () => {
    const car = createCar("a", 300, 300);
    car.align = 90;
    stepCarPhysics(car, keys({ up: true, left: true }), 1);
    assert.equal(car.align, null);
  });

  test("after a glancing hit the nose eases towards the wall, a few degrees per tick", () => {
    const car = createCar("a", 300, 300);
    car.rotation = 225;
    car.align = 270;
    stepCarPhysics(car, keys({ up: true }), 1);
    assert.equal(car.rotation, 225 + PHYSICS.alignStep);
    // 45° at alignStep per tick: about 23 ticks, under a second.
    for (let t = 2; t < 40; t++) stepCarPhysics(car, keys({ up: true }), t);
    assert.equal(car.rotation, 270);
    assert.equal(car.align, null);
  });

  test("speed is capped per axis", () => {
    const car = drive({ up: true }, 200);
    assert.equal(car.vx, -PHYSICS.maxVelocity);
  });

  test("a coasting car slows down faster and faster, then stops", () => {
    const car = drive({ up: true }, 10);
    const start = Math.abs(car.vx);
    stepCarPhysics(car, NO_KEYS, 11);
    const firstDrop = start - Math.abs(car.vx);
    stepCarPhysics(car, NO_KEYS, 12);
    const secondDrop = start - firstDrop - Math.abs(car.vx);
    assert.ok(secondDrop > firstDrop);
    for (let t = 13; t < 100; t++) stepCarPhysics(car, NO_KEYS, t);
    assert.equal(car.vx, 0);
  });

  test("turning while moving changes the heading, and angles wrap into 0–360", () => {
    const right = drive({ up: true, right: true }, 30);
    assert.ok(right.rotation > 0 && right.rotation < 360);
    const left = drive({ up: true, left: true }, 30);
    assert.ok(left.rotation > 180 && left.rotation < 360);
  });

  test("nitro spends a charge, lasts 75 ticks and raises the speed cap", () => {
    const car = createCar("a", 300, 300);
    car.nitro = 1;
    for (let t = 1; t <= 60; t++) stepCarPhysics(car, keys({ up: true, nitro: t === 1 }), t);
    assert.equal(car.nitro, 0);
    assert.equal(car.nitroUntil, 1 + PHYSICS.nitroTicks);
    assert.ok(Math.abs(car.vx) > PHYSICS.maxVelocity);
    for (let t = 61; t <= 1 + PHYSICS.nitroTicks; t++) stepCarPhysics(car, keys({ up: true }), t);
    assert.equal(car.nitroUntil, null);
    assert.ok(Math.abs(car.vx) <= PHYSICS.maxVelocity);
  });

  test("nitro does nothing without a charge", () => {
    const car = drive({ up: true, nitro: true }, 5);
    assert.equal(car.nitroUntil, null);
  });
});

describe("applySlowdown", () => {
  test("costs a share of the speed on both axes, by what was hit", () => {
    const hit = (type: 2 | 3 | 4) => {
      const car = createCar("a", 0, 0);
      car.vx = -6;
      car.vy = 2;
      applySlowdown(car, type);
      return [car.vx, car.vy];
    };
    assert.deepEqual(hit(4), [-4.5, 1.5]); // cone: 25%
    assert.deepEqual(hit(2), [-3.3, 1.1]); // barrel: 45%
    assert.deepEqual(hit(3), [-2.7, 0.9]); // log: 55%
  });
});
