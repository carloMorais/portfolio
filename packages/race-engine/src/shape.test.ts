import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { overlaps } from "./collision.ts";
import { roundCorners } from "./shape.ts";
import type { Box } from "./types.ts";

const solidAt = (walls: Box[], x: number, y: number) =>
  walls.some((w) => overlaps({ x, y, width: 1, height: 1 }, w));

// A 100 × 100 map: walls 10 px thick all round, and a 14 px wall in the middle
// splitting the room into two lanes.
const room: Box[] = [
  { x: 0, y: 0, width: 100, height: 10 },
  { x: 0, y: 90, width: 100, height: 10 },
  { x: 0, y: 0, width: 10, height: 100 },
  { x: 90, y: 0, width: 10, height: 100 },
  { x: 43, y: 30, width: 14, height: 60 },
];

describe("roundCorners", () => {
  const walls = roundCorners(room, 100, 100, { outer: 12, inner: 5 });

  test("fills the outside corners of the road with a curve", () => {
    assert.equal(solidAt(walls, 11, 11), true); // the corner itself
    assert.equal(solidAt(walls, 12, 12), true);
    assert.equal(solidAt(walls, 16, 16), false); // past the curve
    assert.equal(solidAt(walls, 30, 11), false); // the straight is untouched
    assert.equal(solidAt(walls, 11, 60), false);
  });

  test("rounds wall tips without eating thin walls", () => {
    assert.equal(solidAt(walls, 43, 30), false); // the tip's corner is cut
    assert.equal(solidAt(walls, 50, 30), true);
    for (let y = 36; y < 85; y++) {
      for (let x = 43; x < 57; x++) assert.equal(solidAt(walls, x, y), true, `${x},${y}`);
    }
  });

  test("approximates the curves with small boxes", () => {
    const curve = walls.filter((w) => w.height === 1);
    assert.ok(curve.length >= 12, `${curve.length} one-pixel rows`);
  });
});
