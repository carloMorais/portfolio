import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BOT_STYLES, elasticStyle } from "./bot.ts";

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
