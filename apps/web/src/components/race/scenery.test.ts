import { classicTrack, overlaps } from "race-engine";
import { ROCKS, SHEDS, STANDS, TREES, seatFans } from "./scenery";

/** Is the point on the grass, i.e. inside one of the (rounded) walls? */
const onGrass = (x: number, y: number) =>
  classicTrack.walls.some((w) => overlaps({ x, y, width: 1, height: 1 }, w));

describe("scenery", () => {
  test("every stand sits on the grass, a few pixels clear of the road", () => {
    for (const s of STANDS) {
      for (let x = s.x - 3; x <= s.x + s.width + 3; x += 2) {
        for (let y = s.y - 3; y <= s.y + s.height + 3; y += 2) {
          expect([s.x, s.y, x, y, onGrass(x, y)]).toEqual([s.x, s.y, x, y, true]);
        }
      }
    }
  });

  test("every tree's canopy is on the grass", () => {
    for (const t of TREES) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = Math.round(t.x + Math.cos(a) * t.r);
        const y = Math.round(t.y + Math.sin(a) * t.r);
        expect([t.x, t.y, onGrass(x, y)]).toEqual([t.x, t.y, true]);
      }
    }
  });

  test("every rock sits on the grass", () => {
    for (const r of ROCKS) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = Math.round(r.x + Math.cos(a) * r.r);
        const y = Math.round(r.y + Math.sin(a) * r.r);
        expect([r.x, r.y, onGrass(x, y)]).toEqual([r.x, r.y, true]);
      }
    }
  });

  test("every shed sits on the grass, a couple of pixels clear of the road", () => {
    for (const s of SHEDS) {
      for (let x = s.x - 2; x <= s.x + s.w + 2; x += 3) {
        for (let y = s.y - 2; y <= s.y + s.h + 2; y += 3) {
          expect([s.x, s.y, x, y, onGrass(x, y)]).toEqual([s.x, s.y, x, y, true]);
        }
      }
    }
  });

  test("the crowd fills the stands and is the same on every visit", () => {
    const fans = seatFans(STANDS, 7);
    expect(fans.length).toBeGreaterThan(300);
    expect(seatFans(STANDS, 7)).toEqual(fans);
    for (const f of fans) {
      const s = STANDS[f.stand]!;
      expect(f.x > s.x && f.x < s.x + s.width && f.y > s.y && f.y < s.y + s.height).toBe(true);
    }
  });
});
