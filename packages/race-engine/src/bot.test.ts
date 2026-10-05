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
    assert.ok(elasticStyle(normal, -1).topSpeed! <= 6);
  });

  test("easy bots too; hard bots are never helped or held back", () => {
    const easy = BOT_STYLES.easy[0]!;
    assert.ok(elasticStyle(easy, 0.05).topSpeed! < easy.topSpeed!);
    const hard = BOT_STYLES.hard[0]!;
    assert.equal(elasticStyle(hard, 0.5), hard);
    assert.equal(elasticStyle(hard, -0.5), hard);
  });
});

describe("the racing driver (normal and hard)", () => {
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

  test("normal sits between easy and hard, and every normal bot finishes a full grid", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const normal = twoLaps(ids, (i) => BOT_STYLES.normal[i % 3]!);
    assert.ok(normal.every(Number.isFinite), normal.join(" "));
    const avg = normal.reduce((a, b) => a + b) / normal.length;
    const [hard] = twoLaps(["a"], () => BOT_STYLES.hard[2]!);
    const [easy] = twoLaps(["a"], () => BOT_STYLES.easy[0]!);
    assert.ok(avg > hard! + 3 && avg < easy! - 5, `hard ${hard}, normal ${avg}, easy ${easy}`);
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
