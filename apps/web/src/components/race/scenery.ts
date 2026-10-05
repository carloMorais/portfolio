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
export type Rock = { x: number; y: number; r: number };
/** A barrier of three tire stacks, centred on (x, y), in a row across or down. */
export type Tire = { x: number; y: number; vertical: boolean };
export type OilBarrel = { x: number; y: number };

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
  // The top-middle strip and the right lane, clear of the grandstands.
  { x: 260, y: 210, r: 7 },
  { x: 300, y: 175, r: 7 },
  { x: 628, y: 100, r: 7 },
  { x: 625, y: 420, r: 7 },
];

export const ROCKS: Rock[] = [
  { x: 18, y: 110, r: 6 },
  { x: 38, y: 230, r: 6 },
  { x: 18, y: 330, r: 6 },
  { x: 38, y: 440, r: 6 },
  { x: 730, y: 70, r: 5 },
  { x: 735, y: 300, r: 6 },
  { x: 315, y: 225, r: 6 },
  { x: 628, y: 392, r: 6 },
  { x: 300, y: 390, r: 6 },
  { x: 350, y: 388, r: 5.5 },
  { x: 260, y: 448, r: 6 },
  { x: 132, y: 420, r: 6 },
  { x: 440, y: 415, r: 5 },
];

/**
 * Tire barriers and oil barrels: trackside detail, never something you hit.
 * One barrier of three stacks sits outside each corner of the racing line
 * (behind the gravel), lined up along the road edge; the barrels stand at
 * least 10 px off the road, in a neutral blue-grey, so only what you can hit
 * on the road is warm-coloured. Positions found by a script over the actual
 * wall geometry, not by eye; a test checks they stay clear of the road, the
 * stands and each other (05/10/2026).
 */
export const TIRES: Tire[] = [
  { x: 71, y: 580, vertical: false },
  { x: 71, y: 14, vertical: false },
  { x: 217, y: 40, vertical: true },
  { x: 185, y: 332, vertical: false },
  { x: 484, y: 243, vertical: false },
  { x: 448, y: 465, vertical: true },
  { x: 616, y: 470, vertical: true },
  { x: 598, y: 104, vertical: false },
  { x: 284, y: 166, vertical: true },
  { x: 296, y: 22, vertical: false },
  { x: 712, y: 21, vertical: false },
  { x: 706, y: 576, vertical: false },
];

/** Spacing between the stacks of a tire barrier, and each stack's radius. */
export const TIRE_GAP = 7.5;
export const TIRE_R = 3.6;

/** The three stacks of a barrier. */
export const tireStacks = (t: Tire) =>
  [-1, 0, 1].map((k) => ({
    x: t.vertical ? t.x : t.x + k * TIRE_GAP,
    y: t.vertical ? t.y + k * TIRE_GAP : t.y,
  }));

export const OIL_BARRELS: OilBarrel[] = [
  { x: 36, y: 465 },
  { x: 227, y: 170 },
  { x: 738, y: 271 },
  { x: 142, y: 324 },
  { x: 456, y: 484 },
  { x: 623, y: 490 },
  { x: 522, y: 252 },
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
    // A cast shadow on the grass, the same way the trees' fall (down and right).
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.roundRect(s.x + 4, s.y + 6, s.width, s.height, 3);
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
    // Roof along the back edge, with a band in the site's blue on it.
    ctx.fillStyle = c.standRoof;
    if (vertical) ctx.fillRect(s.x, s.y, 4, s.height);
    else if (s.facing === "up") ctx.fillRect(s.x, s.y + s.height - 4, s.width, 4);
    else ctx.fillRect(s.x, s.y, s.width, 4);
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.85;
    if (vertical) ctx.fillRect(s.x + 1, s.y + 2, 1.6, s.height - 4);
    else if (s.facing === "up") ctx.fillRect(s.x + 2, s.y + s.height - 2.6, s.width - 4, 1.6);
    else ctx.fillRect(s.x + 2, s.y + 1, s.width - 4, 1.6);
    ctx.globalAlpha = 1;
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

  for (const r of ROCKS) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.ellipse(r.x + 1.5, r.y + 2.5, r.r, r.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // A squat, faceted boulder: a dark base shape with a lighter top-left facet.
    ctx.fillStyle = c.rock;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.r, r.r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.rockLight;
    ctx.beginPath();
    ctx.ellipse(r.x - r.r * 0.3, r.y - r.r * 0.25, r.r * 0.55, r.r * 0.4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Tire barriers: stacks seen from above, each with a band on its top tire,
  // red and white in turn like the kerbs.
  for (const t of TIRES) {
    tireStacks(t).forEach((st, i) => {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = p.ink;
      ctx.beginPath();
      ctx.arc(st.x + 1.5, st.y + 2, TIRE_R + 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.tire;
      ctx.beginPath();
      ctx.arc(st.x, st.y, TIRE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = i % 2 === 0 ? c.tireBand : c.kerbWhite;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(st.x, st.y, TIRE_R - 1.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = c.tireRim;
      ctx.beginPath();
      ctx.arc(st.x, st.y, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  for (const b of OIL_BARRELS) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.ellipse(b.x + 1, b.y + 2.5, 6.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // A weathered oil drum: a dark body, a near-black band, a dull lid.
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(b.x - 5.5, b.y - 7.5);
      ctx.quadraticCurveTo(b.x - 8, b.y, b.x - 5.5, b.y + 7.5);
      ctx.lineTo(b.x + 5.5, b.y + 7.5);
      ctx.quadraticCurveTo(b.x + 8, b.y, b.x + 5.5, b.y - 7.5);
      ctx.closePath();
    };
    ctx.fillStyle = c.oilBarrel;
    body();
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = c.oilBarrelBand;
    ctx.fillRect(b.x - 8, b.y - 4, 16, 1.8);
    ctx.fillRect(b.x - 8, b.y + 2.2, 16, 1.8);
    ctx.restore();
    ctx.fillStyle = c.oilBarrelBand;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 7.5, 5.5, 1.5, 0, 0, Math.PI * 2);
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
