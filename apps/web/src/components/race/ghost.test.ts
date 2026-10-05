import { NO_KEYS, TICK_RATE } from "race-engine";
import { decodeKeys, encodeKeys, medalFor, nextMedal } from "./ghost";

describe("ghost", () => {
  test("every combination of keys survives the trip through one character", () => {
    for (let bits = 0; bits < 32; bits++) {
      const keys = {
        up: !!(bits & 1),
        down: !!(bits & 2),
        left: !!(bits & 4),
        right: !!(bits & 8),
        nitro: !!(bits & 16),
      };
      const ch = encodeKeys(keys);
      expect(ch).toHaveLength(1);
      expect(decodeKeys(ch)).toEqual(keys);
    }
    // Past the end of a recording: nothing held.
    expect(decodeKeys(undefined)).toEqual(NO_KEYS);
  });

  test("medals go to the best one a time earns, and say how far the next was", () => {
    const s = (seconds: number) => seconds * TICK_RATE;
    expect(medalFor(s(49))).toBe("gold");
    expect(medalFor(s(53))).toBe("silver");
    expect(medalFor(s(60))).toBe("bronze");
    expect(medalFor(s(70))).toBeNull();
    expect(nextMedal(s(57))).toEqual({ id: "silver", missedBy: s(2) });
    expect(nextMedal(s(49))).toBeNull();
  });
});
