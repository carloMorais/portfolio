import type { Box, Car } from "race-engine";
import type { Palette } from "./draw";

/**
 * Trackside scenery for the classic track: grandstands full of fans and a few
 * trees, all on the grass (a test checks none of it touches the road). Purely
 * visual: the engine never sees it.
 */

/** `facing`: the side that looks at the road, where the front row sits. */
export type Stand = Box & { facing: "up" | "down" | "right" };
export type Tree = { x: number; y: number; r: number };

export const STANDS: Stand[] = [
  // Above the S's long middle straight, and over the start straight.
  { x: 200, y: 340, width: 230, height: 34, facing: "up" },
  { x: 200, y: 464, width: 230, height: 34, facing: "down" },
  // Over the top-middle straight.
  { x: 335, y: 192, width: 190, height: 30, facing: "up" },
  // Along the right-hand lane.
  { x: 615, y: 130, width: 30, height: 250, facing: "right" },
];

export const TREES: Tree[] = [
  // Infield between the two middle stands.
  { x: 222, y: 420, r: 9 },
  { x: 262, y: 410, r: 7 },
  { x: 300, y: 424, r: 10 },
  { x: 345, y: 412, r: 7.5 },
  { x: 385, y: 426, r: 9 },
  { x: 422, y: 414, r: 7 },
  // The block left of the top S.
  { x: 245, y: 80, r: 9 },
  { x: 252, y: 140, r: 10 },
  { x: 240, y: 205, r: 8 },
  // Outer edges.
  { x: 27, y: 70, r: 10 },
  { x: 25, y: 170, r: 8 },
  { x: 29, y: 270, r: 11 },
  { x: 26, y: 380, r: 9 },
  { x: 28, y: 490, r: 10 },
  { x: 740, y: 110, r: 9 },
  { x: 742, y: 250, r: 11 },
  { x: 739, y: 390, r: 9 },
  { x: 741, y: 520, r: 10 },
  // Small patch by the last corner.
  { x: 532, y: 499, r: 5.5 },
  { x: 563, y: 498, r: 6 },
];

const SEAT = 6;
const ROW = 7;

/** `color` indexes the palette, so the crowd follows light/dark mode. */
type Fan = { x: number; y: number; color: number; phase: number; stand: number };

/** A small deterministic PRNG, so the crowd looks the same on every visit. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

/** One fan per seat, rows parallel to the road, the front row nearest it. */
export function seatFans(stands: Stand[], colorCount: number): Fan[] {
  const rand = seeded(7);
  const fans: Fan[] = [];
  stands.forEach((s, stand) => {
    const vertical = s.facing === "right";
    const length = vertical ? s.height : s.width;
    const depth = vertical ? s.width : s.height;
    const rows = Math.floor((depth - 6) / ROW);
    const seats = Math.floor((length - 4) / SEAT);
    for (let row = 0; row < rows; row++) {
      for (let seat = 0; seat < seats; seat++) {
        if (rand() < 0.12) continue; // an empty seat here and there
        // Distance from the front edge, then along the stand.
        const fromFront = 4 + row * ROW + ROW / 2;
        const along = 2 + seat * SEAT + SEAT / 2 + (row % 2) * 1.5;
        const x = vertical ? s.x + s.width - fromFront : s.x + along;
        const y = vertical
          ? s.y + along
          : s.facing === "up"
            ? s.y + fromFront
            : s.y + s.height - fromFront;
        fans.push({
          x,
          y,
          color: Math.floor(rand() * colorCount),
          // Along the stand, so a cheer runs down it like a wave.
          phase: seat * 0.45 + rand() * 0.6,
          stand,
        });
      }
    }
  });
  return fans;
}

/** The stands' structure and the trees: static, drawn into the track layer. */
export function drawScenery(ctx: CanvasRenderingContext2D, p: Palette) {
  const c = p.c;
  for (const s of STANDS) {
    const vertical = s.facing === "right";
    ctx.save();
    // Shadow on the grass behind the stand.
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.roundRect(s.x + 2, s.y + 3, s.width, s.height, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.standFront;
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.width, s.height, 3);
    ctx.fill();
    // Terraces: alternating stripes parallel to the road.
    const depth = vertical ? s.width : s.height;
    const rows = Math.floor((depth - 6) / ROW);
    for (let row = 0; row < rows; row++) {
      ctx.fillStyle = row % 2 === 0 ? c.standRow : c.standRowAlt;
      const off = 4 + row * ROW;
      if (vertical) ctx.fillRect(s.x + s.width - off - ROW, s.y + 2, ROW - 0.8, s.height - 4);
      else if (s.facing === "up") ctx.fillRect(s.x + 2, s.y + off, s.width - 4, ROW - 0.8);
      else ctx.fillRect(s.x + 2, s.y + s.height - off - ROW, s.width - 4, ROW - 0.8);
    }
    // Roof along the back edge.
    ctx.fillStyle = c.standRoof;
    if (vertical) ctx.fillRect(s.x, s.y, 3, s.height);
    else if (s.facing === "up") ctx.fillRect(s.x, s.y + s.height - 3, s.width, 3);
    else ctx.fillRect(s.x, s.y, s.width, 3);
    ctx.restore();
  }

  for (const t of TREES) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.ellipse(t.x + 2, t.y + 3, t.r, t.r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.treeLight;
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Distance from a point to a box (0 inside it). */
const distanceToBox = (x: number, y: number, b: Box) =>
  Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.width)), Math.max(b.y - y, 0, y - (b.y + b.height)));

/**
 * The crowd's excitement per stand, eased rather than switched on the spot:
 * it winds up over ~0.5s as a car approaches and winds down over ~0.7s once
 * it's gone, so cheering starts and stops as a ramp, not a jump cut.
 */
export class Crowd {
  private intensity: number[];
  private lastUpdate = 0;

  constructor(standCount: number) {
    this.intensity = new Array(standCount).fill(0);
  }

  private update(stands: Stand[], cars: Pick<Car, "x" | "y" | "width" | "height">[], now: number) {
    const dt = this.lastUpdate ? Math.min(now - this.lastUpdate, 100) : 16;
    this.lastUpdate = now;
    stands.forEach((s, i) => {
      const near = cars.some(
        (car) => distanceToBox(car.x + car.width / 2, car.y + car.height / 2, s) < 70,
      );
      const target = near ? 1 : 0;
      const rate = (target > this.intensity[i]! ? 1 : 0.65) / 450; // winds up a bit faster than down
      const diff = target - this.intensity[i]!;
      this.intensity[i] += Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
    });
  }

  /**
   * Fans sway gently at rest; as their stand's excitement rises they sway
   * less and hop more, a wave running along the row. `still` (reduced
   * motion) freezes the crowd seated, excitement included.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    fans: Fan[],
    colors: string[],
    stands: Stand[],
    cars: Pick<Car, "x" | "y" | "width" | "height">[],
    now: number,
    still: boolean,
  ) {
    if (!still) this.update(stands, cars, now);
    ctx.save();
    for (const f of fans) {
      const hype = still ? 0 : this.intensity[f.stand]!;
      const cheer = Math.abs(Math.sin(now / 130 - f.phase)) * 2.4;
      const sway = Math.max(0, Math.sin(now / 900 + f.phase * 3)) * 0.5;
      const hop = still ? 0 : hype * cheer + (1 - hype) * sway;
      // Shadow stays on the seat; the fan rises above it.
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(f.x + 0.6, f.y + 0.8, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors[f.color % colors.length]!;
      ctx.beginPath();
      ctx.arc(f.x, f.y - hop, 2.1 + hop * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
