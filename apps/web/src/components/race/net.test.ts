/**
 * @jest-environment node
 *
 * Pure netcode: no DOM needed, and the engine uses structuredClone, which
 * jsdom lacks.
 */
import {
  NO_KEYS,
  botKeys,
  classicTrack as track,
  createRace,
  stepRace,
  type Keys,
  type RaceState,
} from "race-engine";
import {
  INTERP_DELAY_TICKS,
  KeyTimeline,
  Predictor,
  Rtt,
  STEP_MS,
  SnapshotBuffer,
  Smoother,
} from "./net";

const UP: Keys = { ...NO_KEYS, up: true };

/** A two-car race run by the "server": car "me" drives with `keysFor(tick)`, "bot" with botKeys. */
function serverRace(ticks: number, keysFor: (tick: number) => Keys): RaceState[] {
  let s = createRace(track, ["me", "bot"], 2);
  const states = [s];
  for (let i = 0; i < ticks; i++) {
    const bot = s.cars[1]!;
    s = stepRace(s, track, { me: keysFor(s.tick + 1), bot: botKeys(bot, track) });
    states.push(s);
  }
  return states;
}

describe("SnapshotBuffer", () => {
  test("shows the other cars INTERP_DELAY_TICKS behind the server, between two real states", () => {
    const states = serverRace(40, () => UP);
    const buffer = new SnapshotBuffer();
    // Messages every 2nd tick, each arriving exactly on time: tick T at T·step.
    for (let t = 2; t <= 40; t += 2) buffer.push(states[t]!, t * STEP_MS);

    const now = 40 * STEP_MS;
    expect(buffer.renderTick(now)).toBeCloseTo(40 - INTERP_DELAY_TICKS);
    const half = buffer.sample(now + STEP_MS)!; // tick 37: halfway between 36 and 38
    expect(half.a.tick).toBe(36);
    expect(half.b.tick).toBe(38);
    expect(half.alpha).toBeCloseTo(0.5);
  });

  test("a late message doesn't move the clock: the least-delayed one sets it", () => {
    const states = serverRace(10, () => UP);
    const buffer = new SnapshotBuffer();
    buffer.push(states[2]!, 2 * STEP_MS);
    buffer.push(states[4]!, 4 * STEP_MS + 80); // 80 ms of network jitter
    expect(buffer.renderTick(4 * STEP_MS)).toBeCloseTo(4 - INTERP_DELAY_TICKS);
  });

  test("arrivalOf ignores jitter: a late message keeps the same clock", () => {
    const states = serverRace(10, () => UP);
    const buffer = new SnapshotBuffer();
    buffer.push(states[2]!, 2 * STEP_MS);
    buffer.push(states[4]!, 4 * STEP_MS + 80);
    expect(buffer.arrivalOf(4)).toBeCloseTo(4 * STEP_MS);
  });

  test("takeDue hands each state out once, when it comes into view", () => {
    const states = serverRace(20, () => UP);
    const buffer = new SnapshotBuffer();
    for (let t = 2; t <= 20; t += 2) buffer.push(states[t]!, t * STEP_MS);
    // At tick 20, tick 16 is on screen: 2…16 are due, 18 and 20 not yet.
    const due = buffer.takeDue(20 * STEP_MS).map((s) => s.tick);
    expect(due).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(buffer.takeDue(20 * STEP_MS)).toEqual([]);
    expect(buffer.takeDue(22 * STEP_MS).map((s) => s.tick)).toEqual([18]);
  });

  test("past the newest state it holds it, rather than guessing", () => {
    const states = serverRace(4, () => UP);
    const buffer = new SnapshotBuffer();
    buffer.push(states[2]!, 0);
    expect(buffer.sample(10_000)).toEqual({ a: states[2], b: states[2], alpha: 0 });
  });
});

describe("KeyTimeline", () => {
  test("answers which keys were in force at any moment", () => {
    const keys = new KeyTimeline();
    keys.record(100, UP);
    keys.record(200, NO_KEYS);
    expect(keys.keysAt(50)).toEqual(NO_KEYS);
    expect(keys.keysAt(150)).toEqual(UP);
    expect(keys.keysAt(250)).toEqual(NO_KEYS);
  });
});

describe("Predictor", () => {
  test("with no latency, the predicted car is exactly the server's car", () => {
    // Throttle, then a left turn from tick 10: what the server ran.
    const keysFor = (tick: number): Keys => (tick >= 10 ? { ...UP, left: true } : UP);
    const states = serverRace(20, keysFor);
    const timeline = new KeyTimeline();
    // The client pressed those keys at the local times the ticks ran (rtt 0).
    timeline.record(0, UP);
    timeline.record(10 * STEP_MS, { ...UP, left: true });

    const predictor = new Predictor();
    predictor.reset(states[4]!, 4 * STEP_MS, "me");
    // 12 ticks after tick 4's state arrived, with no round trip: tick 16.
    const car = predictor.at(16 * STEP_MS, 0, (t) => timeline.keysAt(t))!;
    const truth = states[16]!.cars.find((c) => c.id === "me")!;
    expect(car.x).toBeCloseTo(truth.x);
    expect(car.y).toBeCloseTo(truth.y);
    expect(car.rotation).toBeCloseTo(truth.rotation);
  });

  test("with latency, your car is drawn ahead by the round trip, not behind it", () => {
    const states = serverRace(30, () => UP);
    const timeline = new KeyTimeline();
    timeline.record(-1000, UP);
    const predictor = new Predictor();
    const rtt = 6 * STEP_MS; // 200 ms
    predictor.reset(states[10]!, 0, "me");
    // Right as tick 10 arrives, the car shown is where it'll be 6 ticks later.
    const car = predictor.at(0, rtt, (t) => timeline.keysAt(t))!;
    expect(car.x).toBeCloseTo(states[16]!.cars[0]!.x);
  });

  test("each predicted tick goes to the effects once, even when a new state re-steps it", () => {
    const states = serverRace(30, () => UP);
    const timeline = new KeyTimeline();
    timeline.record(-1000, UP);
    const predictor = new Predictor();
    const rtt = 4 * STEP_MS;
    const keys = (t: number) => timeline.keysAt(t);
    predictor.reset(states[10]!, 10 * STEP_MS, "me");
    predictor.at(10 * STEP_MS, rtt, keys);
    const first = predictor.takeTicks().map((s) => s.tick);
    expect(first).toEqual([11, 12, 13, 14, 15]);
    // Tick 12 arrives: the predictor starts over from it, but 13–15 were already shown.
    predictor.reset(states[12]!, 12 * STEP_MS, "me");
    predictor.at(12 * STEP_MS, rtt, keys);
    expect(predictor.takeTicks().map((s) => s.tick)).toEqual([16, 17]);
    expect(predictor.tick).toBeCloseTo(16);
  });

  test("anchored on arrivalOf, a late message doesn't pull your car back", () => {
    const states = serverRace(30, () => UP);
    const timeline = new KeyTimeline();
    timeline.record(-1000, UP);
    const buffer = new SnapshotBuffer();
    const predictor = new Predictor();
    const keys = (t: number) => timeline.keysAt(t);
    const rtt = 4 * STEP_MS;
    buffer.push(states[10]!, 10 * STEP_MS);
    predictor.reset(states[10]!, buffer.arrivalOf(10), "me");
    const before = predictor.at(12 * STEP_MS + 60, rtt, keys)!;
    // Tick 12 shows up 60 ms late; drawn at that same moment, the car is no further back.
    buffer.push(states[12]!, 12 * STEP_MS + 60);
    predictor.reset(states[12]!, buffer.arrivalOf(12), "me");
    const after = predictor.at(12 * STEP_MS + 60, rtt, keys)!;
    expect(after.y).toBeCloseTo(before.y);
    expect(after.x).toBeCloseTo(before.x);
  });

  test("nothing to predict before the race's first state", () => {
    const predictor = new Predictor();
    expect(predictor.at(0, 100, () => UP)).toBeNull();
  });
});

describe("Smoother", () => {
  test("a small correction fades out instead of jumping; a big one snaps", () => {
    const car = createRace(track, ["me"], 2).cars[0]!;
    const smoother = new Smoother();
    smoother.apply(car, 0);
    // The server says the car is 10 px further left than shown.
    smoother.correct({ ...car, x: car.x - 10 });
    expect(smoother.apply({ ...car, x: car.x - 10 }, 0).x).toBeCloseTo(car.x);
    expect(smoother.apply({ ...car, x: car.x - 10 }, 300).x).toBeCloseTo(car.x - 10, 0);

    smoother.correct({ ...car, x: car.x + 200 });
    expect(smoother.apply({ ...car, x: car.x + 200 }, 301).x).toBe(car.x + 200);
  });
});

describe("Rtt", () => {
  test("starts from the first reading, then smooths spikes and clamps nonsense", () => {
    const rtt = new Rtt();
    rtt.sample(120);
    expect(rtt.value).toBe(120);
    rtt.sample(620); // one slow reply (clamped to 500)
    expect(rtt.value).toBeCloseTo(120 * 0.8 + 500 * 0.2);
  });
});
