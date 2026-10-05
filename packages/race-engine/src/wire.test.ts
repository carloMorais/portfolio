import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { botKeys } from "./bot.ts";
import { activeItems, createRace, standings, stepRace } from "./race.ts";
import { classicTrack as track } from "./track.ts";
import type { Keys, RaceEvent, RaceState } from "./types.ts";
import { RaceDecoder, encodeSync, encodeTick } from "./wire.ts";

/**
 * JSON has no -0 (it serializes as 0), and the engine sometimes produces -0
 * speeds; they behave the same in every calculation, so compare without the sign.
 */
const noNegZero = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe("wire format", () => {
  test("a whole race, sent every other tick, decodes to exactly the engine's state", () => {
    const ids = ["a", "b", "c", "d"];
    const skills = [1, 0.9, 0.8, 0.7];
    let s = createRace(track, ids, 2);
    const decoder = new RaceDecoder(track, ids, 2);
    let pending: RaceEvent[] = [];
    let compared = 0;
    while (s.finished.length < ids.length && s.tick < 30 * 120) {
      const inputs: Record<string, Keys> = {};
      s.cars.forEach((c, i) => (inputs[c.id] = botKeys(c, track, { skill: skills[i]! })));
      s = stepRace(s, track, inputs);
      pending.push(...s.events);
      if (s.tick % 2 !== 0) continue;
      const msg = JSON.parse(JSON.stringify(encodeTick(s, pending)));
      pending = [];
      const d = decoder.apply(msg);
      // Everything a client reads: every car field, the finishing order, the items.
      assert.deepEqual(d.cars, noNegZero(s.cars));
      assert.deepEqual(d.finished, s.finished);
      assert.deepEqual(
        activeItems(track, d).map((it) => it.id),
        activeItems(track, s).map((it) => it.id),
      );
      assert.deepEqual(
        standings(d, track).map((c) => c.id),
        standings(s, track).map((c) => c.id),
      );
      compared++;
    }
    assert.equal(s.finished.length, ids.length, "the bots should finish");
    assert.ok(compared > 500, `compared only ${compared} messages`);
  });

  test("joining mid-race from a sync decodes to the engine's state from then on", () => {
    const ids = ["a", "b", "c"];
    let s = createRace(track, ids, 2);
    let late: RaceDecoder | null = null;
    let pending: RaceEvent[] = [];
    let compared = 0;
    while (s.finished.length < ids.length && s.tick < 30 * 120) {
      const inputs: Record<string, Keys> = {};
      s.cars.forEach((c) => (inputs[c.id] = botKeys(c, track, { skill: 1 })));
      s = stepRace(s, track, inputs);
      pending.push(...s.events);
      if (s.tick % 2 !== 0) continue;
      const msg = JSON.parse(JSON.stringify(encodeTick(s, pending)));
      pending = [];
      if (late) {
        const d: RaceState = late.apply(msg);
        assert.deepEqual(d.cars, noNegZero(s.cars));
        assert.deepEqual(d.finished, s.finished);
        assert.deepEqual(
          activeItems(track, d).map((it) => it.id),
          activeItems(track, s).map((it) => it.id),
        );
        compared++;
      } else if (s.cars.some((c) => c.laps === 1)) {
        // Someone has a lap done and items are off the track: join now.
        late = new RaceDecoder(track, ids, 2);
        const d = late.resume(JSON.parse(JSON.stringify(encodeSync(s))));
        assert.deepEqual(d.cars, noNegZero(s.cars));
      }
    }
    assert.ok(compared > 200, `compared only ${compared} messages`);
  });

  test("a quiet tick leaves the events out, and a 10-car tick stays small", () => {
    const s = stepRace(
      createRace(
        track,
        Array.from({ length: 10 }, (_, i) => `car${i}`),
        2,
      ),
      track,
      {},
    );
    const msg = encodeTick(s, []);
    assert.equal("e" in msg, false);
    // The old object-per-car format was ~1.85 KB for 10 cars.
    assert.ok(JSON.stringify(msg).length < 800, `got ${JSON.stringify(msg).length} bytes`);
  });
});
