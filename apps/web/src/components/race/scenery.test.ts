import { classicTrack, overlaps } from "race-engine";
import { OIL_BARRELS, ROCKS, STANDS, TIRES, TIRE_R, TREES, seatFans, tireStacks } from "./scenery";

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

  test("every tire barrier sits on the grass, a few pixels off the road", () => {
    for (const t of TIRES) {
      for (const st of tireStacks(t)) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
          const x = Math.round(st.x + Math.cos(a) * (TIRE_R + 3));
          const y = Math.round(st.y + Math.sin(a) * (TIRE_R + 3));
          expect([t.x, t.y, onGrass(x, y)]).toEqual([t.x, t.y, true]);
        }
      }
    }
  });

  test("every oil barrel stands at least 10 px off the road (it must never read as an obstacle)", () => {
    for (const b of OIL_BARRELS) {
      // The drum is ~7 px from its centre to its side: 17 px leaves 10 px of grass.
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
        const x = Math.round(b.x + Math.cos(a) * 17);
        const y = Math.round(b.y + Math.sin(a) * 17);
        expect([b.x, b.y, onGrass(x, y)]).toEqual([b.x, b.y, true]);
      }
    }
  });

  test("no two pieces of scenery sit on top of each other", () => {
    const round = [...TREES, ...ROCKS].map((o) => ({ ...o, r: o.r }));
    const small = [
      ...TIRES.flatMap((t) => tireStacks(t).map((st) => ({ ...st, r: TIRE_R }))),
      ...OIL_BARRELS.map((b) => ({ ...b, r: 8 })),
    ];
    const points = [...round, ...small];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]!;
        const b = points[j]!;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        expect([a, b, dist >= a.r + b.r]).toEqual([a, b, true]);
      }
      const p = points[i]!;
      expect(
        STANDS.some(
          (s) =>
            p.x > s.x - p.r &&
            p.x < s.x + s.width + p.r &&
            p.y > s.y - p.r &&
            p.y < s.y + s.height + p.r,
        ),
      ).toBe(false);
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
