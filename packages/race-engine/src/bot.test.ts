import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BOT_STYLES, botKeys, elasticStyle, type BotStyle } from "./bot.ts";
import { TICK_RATE } from "./constants.ts";
import { createRace, stepRace } from "./race.ts";
import { classicTrack } from "./track.ts";
import type { Keys } from "./types.ts";

describe("elasticStyle", () => {
  const normal = BOT_STYLES.normal[0]!;

  test("a bot level with the leading human drives as usual", () => {
    assert.deepEqual(elasticStyle(normal, 0), normal);
  });

  test("well ahead, it eases off; well behind, it pushes (within limits)", () => {
    assert.ok(elasticStyle(normal, 0.05).topSpeed! < normal.topSpeed!);
    assert.ok(elasticStyle(normal, -0.05).topSpeed! > normal.topSpeed!);
    assert.equal(elasticStyle(normal, 1).topSpeed, normal.topSpeed! * 0.85);
    assert.ok(elasticStyle(normal, -1).topSpeed! <= 5.8);
  });

  test("hard bots are never helped or held back", () => {
    const hard = BOT_STYLES.hard[0]!;
    assert.equal(elasticStyle(hard, 0.5), hard);
    assert.equal(elasticStyle(hard, -0.5), hard);
  });
});

describe("hard bots (the racing driver)", () => {
  const twoLaps = (ids: string[], styleOf: (i: number) => BotStyle) => {
    let s = createRace(classicTrack, ids, 2);
    while (s.finished.length < ids.length && s.tick < 90 * TICK_RATE) {
      const inputs: Record<string, Keys> = {};
      s.cars.forEach((c, i) => (inputs[c.id] = botKeys(c, classicTrack, styleOf(i))));
      s = stepRace(s, classicTrack, inputs);
    }
    return s.cars.map((c) => (c.finishedAt ?? Infinity) / TICK_RATE);
  };

  test("the fastest beats the plain driver by a wide margin", () => {
    const [racing] = twoLaps(["a"], () => BOT_STYLES.hard[0]!);
    const [plain] = twoLaps(["a"], () => ({ skill: 1 }));
    assert.ok(racing! < 45, `racing ${racing}`);
    assert.ok(racing! < plain! - 5, `racing ${racing}, plain ${plain}`);
  });

  test("every grid slot finishes, and the three styles keep their order on average", () => {
    const ids = Array.from({ length: 9 }, (_, i) => `c${i}`);
    const times = twoLaps(ids, (i) => BOT_STYLES.hard[i % 3]!);
    assert.ok(times.every(Number.isFinite), times.join(" "));
    const avg = (k: number) => {
      const own = times.filter((_, i) => i % 3 === k);
      return own.reduce((a, b) => a + b) / own.length;
    };
    assert.ok(avg(0) < avg(1) && avg(1) < avg(2), [0, 1, 2].map(avg).join(" "));
  });
});
