import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { botKeys } from "./bot.ts";
import { overlaps } from "./collision.ts";
import { PHYSICS, TICK_RATE } from "./constants.ts";
import { activeItems, createRace, standings, stepRace, wrongWay } from "./race.ts";
import { classicTrack as track } from "./track.ts";
import { NO_KEYS, type Keys, type RaceState } from "./types.ts";

/** Runs bots for every car until all finish or `seconds` pass. */
function raceBots(state: RaceState, seconds: number, skills: Record<string, number> = {}) {
  let s = state;
  const checkpointsSeen: Record<string, number[]> = {};
  for (let t = 0; t < seconds * TICK_RATE && s.finished.length < s.cars.length; t++) {
    const inputs: Record<string, Keys> = {};
    for (const car of s.cars) {
      inputs[car.id] = botKeys(car, track, { skill: skills[car.id] ?? 1 });
    }
    s = stepRace(s, track, inputs);
    for (const car of s.cars) {
      const seen = (checkpointsSeen[car.id] ??= []);
      if (car.checkpoint !== 0 && seen.at(-1) !== car.checkpoint) seen.push(car.checkpoint);
    }
  }
  return { state: s, checkpointsSeen };
}

describe("createRace", () => {
  test("no car starts on the finish line or a checkpoint", () => {
    const s = createRace(
      track,
      Array.from({ length: 10 }, (_, i) => `c${i}`),
    );
    for (const car of s.cars) {
      for (const box of [track.finishLine, ...track.checkpoints, ...track.walls]) {
        assert.equal(overlaps(car, box), false, `${car.id} at ${car.x},${car.y}`);
      }
    }
  });
});

describe("stepRace", () => {
  test("is pure and deterministic: same inputs, same race", () => {
    const start = createRace(track, ["a", "b"]);
    const snapshot = structuredClone(start);
    const inputs = { a: { ...NO_KEYS, up: true, left: true }, b: { ...NO_KEYS, up: true } };
    let x = start;
    let y = structuredClone(start);
    for (let i = 0; i < 120; i++) {
      x = stepRace(x, track, inputs);
      y = stepRace(y, track, inputs);
    }
    assert.deepEqual(x, y);
    assert.deepEqual(start, snapshot);
  });

  test("a bot completes a lap, crossing the checkpoints in order", () => {
    const { state, checkpointsSeen } = raceBots(createRace(track, ["bot"], 1), 60);
    assert.deepEqual(state.finished, ["bot"]);
    assert.deepEqual(checkpointsSeen.bot, [1, 2, 3, 4, 5]);
    assert.ok(state.tick < 40 * TICK_RATE, `lap took ${state.tick / TICK_RATE}s`);
  });

  test("a full grid of 10 bots finishes a 3-lap race, none stuck or inside a wall", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `bot${i}`);
    const skills = Object.fromEntries(ids.map((id, i) => [id, i % 2 === 0 ? 1.2 : 0.8]));
    const { state } = raceBots(createRace(track, ids, 3), 240, skills);
    assert.equal(state.finished.length, 10);
    for (const car of state.cars) {
      assert.equal(
        track.walls.some((w) => overlaps(car, w)),
        false,
        `${car.id} inside a wall`,
      );
    }
  });

  test("hitting two walls at a corner never tunnels the car through them", () => {
    // Recorded from a bot run: coming down the inner lane into the corner where
    // two walls meet. The original resolved the second wall after the car had
    // left it, pushed it back into the first, and it escaped through the far side.
    let s = createRace(track, ["a"]);
    s.cars[0] = {
      ...s.cars[0]!,
      x: 166.85,
      y: 294.25,
      vx: 1.71,
      vy: 6,
      rotation: 182.5,
      checkpoint: 2,
      waypoint: 7,
    };
    for (let i = 0; i < 30; i++) {
      s = stepRace(s, track, { a: botKeys(s.cars[0]!, track) });
      const car = s.cars[0]!;
      assert.ok(car.y < 320, `tick ${s.tick}: car fell through to y=${car.y}`);
      assert.equal(
        track.walls.some((w) => overlaps(car, w)),
        false,
      );
    }
  });

  test("full throttle into the stepped top corner never pins the car", () => {
    // Reported: heading right along the top into the corner where the inner
    // lane starts (x 195–290, y 15–50), turning down, throttle held: stuck.
    // Driving from there towards the middle of the lane must get out.
    for (const y of [20, 25, 30, 35, 40, 50, 60]) {
      let s = createRace(track, ["a"]);
      s.cars[0] = { ...s.cars[0]!, x: 120, y, rotation: 180, vx: 6, checkpoint: 1, waypoint: 5 };
      let escapedAt = -1;
      for (let i = 0; i < 5 * TICK_RATE && escapedAt < 0; i++) {
        s = stepRace(s, track, { a: botKeys(s.cars[0]!, track) });
        if (s.cars[0]!.y > 200) escapedAt = i;
      }
      assert.ok(escapedAt >= 0, `entering at y=${y}: still at ${s.cars[0]!.x},${s.cars[0]!.y}`);
    }
  });

  test("a glancing hit keeps the car going and turns it along the wall", () => {
    // Img 2: in the right lane, nose down and to the right, throttle held, into the outer wall.
    let s = createRace(track, ["a"]);
    s.cars[0] = { ...s.cars[0]!, x: 690, y: 150, rotation: 225, vx: 3, vy: 3, checkpoint: 3 };
    let bumped = false;
    for (let i = 0; i < 30; i++) {
      s = stepRace(s, track, { a: { ...NO_KEYS, up: true } });
      bumped ||= s.cars[0]!.align !== null;
    }
    const car = s.cars[0]!;
    assert.ok(bumped, "the wall hit started an alignment");
    assert.ok(car.y > 250, `kept driving down (y=${car.y})`);
    assert.ok(Math.abs(car.rotation - 270) < 10, `nose turned down (rotation ${car.rotation})`);
  });

  test("checkpoints only count in order: driving backwards into one bounces off it", () => {
    let s = createRace(track, ["a"]);
    // Just right of checkpoint 5, rolling left into it with no checkpoint done.
    const cp5 = track.checkpoints[4]!;
    s.cars[0] = { ...s.cars[0]!, x: cp5.x + cp5.width + 2, y: 540, vx: -5 };
    s = stepRace(s, track, { a: NO_KEYS });
    s = stepRace(s, track, { a: NO_KEYS });
    assert.equal(s.cars[0]!.checkpoint, 0);
    assert.ok(s.cars[0]!.vx >= 0, "bounced back");
  });

  test("the finish line counts a lap only after every checkpoint", () => {
    let s = createRace(track, ["a"], 1);
    const line = track.finishLine;
    s.cars[0] = { ...s.cars[0]!, x: line.x + line.width + 1, y: 540, vx: -4, checkpoint: 5 };
    for (let i = 0; i < 5; i++) s = stepRace(s, track, { a: NO_KEYS });
    assert.equal(s.cars[0]!.laps, 1);
    assert.deepEqual(s.finished, ["a"]);
    assert.notEqual(s.cars[0]!.finishedAt, null);
  });

  test("finished cars stop taking input", () => {
    let s = createRace(track, ["a"]);
    s.cars[0] = { ...s.cars[0]!, finishedAt: 0 };
    s = stepRace(s, track, { a: { ...NO_KEYS, up: true } });
    assert.equal(s.cars[0]!.vx, 0);
  });

  test("a nitro pickup is collected and comes back after 3 seconds", () => {
    const nitro = track.items.find((it) => it.type === 1)!;
    let s = createRace(track, ["a"]);
    s.cars[0] = { ...s.cars[0]!, x: nitro.x, y: nitro.y };
    s = stepRace(s, track, { a: NO_KEYS });
    assert.equal(s.cars[0]!.nitro, 1);
    assert.ok(!activeItems(track, s).some((it) => it.id === nitro.id));
    s.cars[0] = { ...s.cars[0]!, x: 300, y: 540 };
    for (let i = 0; i < PHYSICS.itemRespawnTicks; i++) s = stepRace(s, track, { a: NO_KEYS });
    assert.ok(activeItems(track, s).some((it) => it.id === nitro.id));
  });

  test("with a full tank the nitro stays on the track", () => {
    const nitro = track.items.find((it) => it.type === 1)!;
    let s = createRace(track, ["a"]);
    s.cars[0] = { ...s.cars[0]!, x: nitro.x, y: nitro.y, nitro: PHYSICS.maxNitro };
    s = stepRace(s, track, { a: NO_KEYS });
    assert.ok(activeItems(track, s).some((it) => it.id === nitro.id));
  });

  test("a barrel slows the car down", () => {
    const barrel = track.items.find((it) => it.type === 2)!;
    let s = createRace(track, ["a"]);
    s.cars[0] = { ...s.cars[0]!, x: barrel.x, y: barrel.y, vx: 0, vy: -5.5 };
    s = stepRace(s, track, { a: NO_KEYS });
    // Coasting drag first (−5.5 → −5.42), then 70% of what is left (the 2024 game took a fixed 5).
    assert.equal(s.cars[0]!.vy, -1.63);
  });

  test("a wall hit is reported with its impact and direction", () => {
    let s = createRace(track, ["a"]);
    // Rolling down into the bottom wall of the start straight.
    s.cars[0] = { ...s.cars[0]!, x: 300, y: 550, vy: 6 };
    s = stepRace(s, track, { a: NO_KEYS });
    const bump = s.events.find((e) => e.type === "bump");
    assert.ok(bump && bump.type === "bump");
    assert.deepEqual([bump.car, bump.nx, bump.ny, bump.gate], ["a", 0, 1, false]);
    assert.ok(bump.impact > 4);
    // Events only describe the last tick.
    s.cars[0] = { ...s.cars[0]!, y: 540, vy: 0 };
    s = stepRace(s, track, { a: NO_KEYS });
    assert.deepEqual(s.events, []);
  });

  test("bouncing off an out-of-order checkpoint is reported as a gate", () => {
    let s = createRace(track, ["a"]);
    const cp5 = track.checkpoints[4]!;
    s.cars[0] = { ...s.cars[0]!, x: cp5.x + cp5.width + 2, y: 540, vx: -5 };
    s = stepRace(s, track, { a: NO_KEYS });
    assert.ok(s.events.some((e) => e.type === "bump" && e.gate));
  });

  test("pickups and laps are reported, and each lap is timed", () => {
    const barrel = track.items.find((it) => it.type === 2)!;
    let s = createRace(track, ["a"]);
    s.cars[0] = { ...s.cars[0]!, x: barrel.x, y: barrel.y };
    s = stepRace(s, track, { a: NO_KEYS });
    assert.deepEqual(s.events, [{ type: "pickup", car: "a", item: barrel.id, itemType: 2 }]);

    const { state } = raceBots(createRace(track, ["bot"], 2), 120);
    const car = state.cars[0]!;
    assert.equal(car.lapTicks.length, 2);
    assert.equal(car.lapTicks[0]! + car.lapTicks[1]!, car.finishedAt);
  });

  test("driving against the racing line is the wrong way", () => {
    const s = createRace(track, ["a"]);
    // On the grid the racing line runs left, to the finish line.
    const car = { ...s.cars[0]!, vx: 4 };
    assert.equal(wrongWay(car, track), true);
    assert.equal(wrongWay({ ...car, vx: -4 }, track), false);
    assert.equal(wrongWay({ ...car, vx: 1 }, track), false); // too slow to tell
  });

  test("leaving the map sends the car back to the start", () => {
    let s = createRace(track, ["a"]);
    s.cars[0] = { ...s.cars[0]!, x: -40, y: 300, checkpoint: 2 };
    s = stepRace(s, track, { a: NO_KEYS });
    assert.deepEqual([s.cars[0]!.x, s.cars[0]!.y, s.cars[0]!.checkpoint], [380, 540, 0]);
  });
});

describe("standings", () => {
  test("ranks by laps, then by progress along the racing line", () => {
    const s = createRace(track, ["slow", "fast", "lapped"]);
    s.cars[0] = { ...s.cars[0]!, waypoint: 3 };
    s.cars[1] = { ...s.cars[1]!, waypoint: 9 };
    s.cars[2] = { ...s.cars[2]!, laps: 1, waypoint: 1 };
    assert.deepEqual(
      standings(s, track).map((c) => c.id),
      ["lapped", "fast", "slow"],
    );
  });

  test("a car heading to the finish with every checkpoint done is not last", () => {
    const s = createRace(track, ["closing", "mid"]);
    s.cars[0] = { ...s.cars[0]!, waypoint: 0, checkpoint: track.checkpoints.length };
    s.cars[1] = { ...s.cars[1]!, waypoint: 12, checkpoint: 3 };
    assert.equal(standings(s, track)[0]!.id, "closing");
  });
});

describe("botKeys", () => {
  test("a lower top speed makes a slower bot: that is the difficulty", () => {
    const time = (topSpeed?: number) => {
      let s = createRace(track, ["b"], 1);
      while (s.finished.length === 0 && s.tick < 120 * TICK_RATE) {
        s = stepRace(s, track, { b: botKeys(s.cars[0]!, track, { skill: 1, topSpeed }) });
      }
      return s.cars[0]!.finishedAt ?? Infinity;
    };
    const [easy, normal, hard] = [time(3.75), time(5), time()];
    assert.ok(easy > normal && normal > hard, `easy ${easy}, normal ${normal}, hard ${hard}`);
  });
});
