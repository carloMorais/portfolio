import { gridPosition, PHYSICS, type Box, type Car, type ItemSpawn, type Track } from "race-engine";
import { COLORS, type GameColors } from "./colors";

/**
 * Colours for the canvas: a couple of the site's tokens (for text that sits
 * over the game), plus the game's own fixed palette (`c`).
 */
export type Palette = {
  bg: string;
  ink: string;
  line: string;
  accent: string;
  /** The page's text font, for labels drawn on the canvas. */
  font: string;
  c: GameColors;
};

export function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    font: css.fontFamily,
    bg: v("--bg"),
    ink: v("--ink"),
    line: v("--line"),
    accent: v("--accent"),
    c: COLORS,
  };
}

/** A small deterministic PRNG (shared shape with scenery.ts's), for the grass texture. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

type Point = { x: number; y: number };

/**
 * The corners of the racing line: every waypoint where it turns by more than
 * 45°, with the direction pointing to the outside of the bend (where a car
 * that runs wide ends up). Kerbs and gravel are placed from these, so they
 * follow the track instead of being placed by eye.
 */
export function trackCorners(track: Track): (Point & { out: Point })[] {
  const wps = track.waypoints;
  const unit = (x: number, y: number) => {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  };
  return wps.flatMap((p, i) => {
    const a = wps[(i - 1 + wps.length) % wps.length]!;
    const b = wps[(i + 1) % wps.length]!;
    const din = unit(p.x - a.x, p.y - a.y);
    const dout = unit(b.x - p.x, b.y - p.y);
    const turn = Math.acos(Math.max(-1, Math.min(1, din.x * dout.x + din.y * dout.y)));
    if (turn < Math.PI / 4) return [];
    // The bend pulls towards (dout − din); the outside is the other way.
    return [{ x: p.x, y: p.y, out: unit(din.x - dout.x, din.y - dout.y) }];
  });
}

const KERB_REACH = 42;
const KERB_WIDTH = 4;

/** The racing line as a closed path, curved through the waypoints (quadratics via their midpoints). */
function racingLine(ctx: CanvasRenderingContext2D, track: Track) {
  const wps = track.waypoints;
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(wps[wps.length - 1]!, wps[0]!);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < wps.length; i++) {
    const cur = wps[i]!;
    const m = mid(cur, wps[(i + 1) % wps.length]!);
    ctx.quadraticCurveTo(cur.x, cur.y, m.x, m.y);
  }
  ctx.closePath();
}

/** The walls (grass) as one clip path, optionally grown by `grow` px. */
function wallsPath(ctx: CanvasRenderingContext2D, track: Track, grow = 0) {
  ctx.beginPath();
  for (const w of track.walls)
    ctx.rect(w.x - grow, w.y - grow, w.width + grow * 2, w.height + grow * 2);
}

/**
 * The track, drawn from the engine's own collision boxes so what you see is
 * exactly what you hit: grey asphalt with a light kerb and a dashed line
 * along the racing line, everything off it mottled green grass (small
 * blotches, not a hatch pattern).
 */
export function drawTrack(ctx: CanvasRenderingContext2D, track: Track, p: Palette) {
  const { width, height } = track;
  const c = p.c;
  ctx.fillStyle = c.road;
  ctx.fillRect(0, 0, width, height);

  // A light asphalt grain (kerb and grass are painted over it everywhere
  // but the actual road, so no clipping needed here).
  const grain = seeded(29);
  ctx.save();
  for (let gy = 0; gy < height; gy += 5) {
    for (let gx = 0; gx < width; gx += 5) {
      if (grain() < 0.6) continue;
      const x = gx + grain() * 4;
      const y = gy + grain() * 4;
      ctx.globalAlpha = 0.05 + grain() * 0.05;
      ctx.fillStyle = grain() < 0.5 ? "#000000" : "#ffffff";
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }
  ctx.restore();

  // Kerb: the walls grown by a few pixels, a light outer band and a near-white inner line.
  ctx.fillStyle = c.kerbOuter;
  for (const w of track.walls) ctx.fillRect(w.x - 3, w.y - 3, w.width + 6, w.height + 6);
  ctx.fillStyle = c.kerbInner;
  for (const w of track.walls) ctx.fillRect(w.x - 1, w.y - 1, w.width + 2, w.height + 2);

  // Corners get proper red-and-white kerbs: the band along the road edge
  // within reach of each bend, striped by angle around it so the blocks run
  // along the curve.
  const corners = trackCorners(track);
  for (const corner of corners) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, KERB_REACH, 0, Math.PI * 2);
    ctx.clip();
    wallsPath(ctx, track, KERB_WIDTH);
    ctx.clip();
    const step = 0.2;
    for (let a = 0, i = 0; a < Math.PI * 2; a += step, i++) {
      ctx.fillStyle = i % 2 === 0 ? c.kerbRed : c.kerbWhite;
      ctx.beginPath();
      ctx.moveTo(corner.x, corner.y);
      ctx.arc(corner.x, corner.y, KERB_REACH + 2, a, a + step + 0.01);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Grass, clipped to the walls, with scattered blotches instead of a hatch.
  ctx.save();
  ctx.beginPath();
  for (const w of track.walls) ctx.rect(w.x, w.y, w.width, w.height);
  ctx.clip();
  ctx.fillStyle = c.grass;
  ctx.fillRect(0, 0, width, height);
  const rand = seeded(13);
  for (let gy = -6; gy < height; gy += 13) {
    for (let gx = -6; gx < width; gx += 13) {
      if (rand() < 0.5) continue;
      const x = gx + rand() * 11;
      const y = gy + rand() * 11;
      const r = 3 + rand() * 3.5;
      ctx.globalAlpha = 0.3 + rand() * 0.3;
      ctx.fillStyle = rand() < 0.5 ? c.grassBlotchDark : c.grassBlotchLight;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.75, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Gravel run-off on the grass outside each bend, where a car running wide
  // would go: a band hugging the road (the racing line stroked wider than the
  // lane), only on the outside of the corner. Its grain is a small pattern.
  const tile = document.createElement("canvas");
  tile.width = tile.height = 16;
  const g = tile.getContext("2d")!;
  g.fillStyle = c.gravel;
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = c.gravelDot;
  const dots = seeded(41);
  for (let k = 0; k < 14; k++) g.fillRect(dots() * 16, dots() * 16, 1.2, 1.2);
  const pattern = ctx.createPattern(tile, "repeat");
  for (const corner of corners) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(corner.x + corner.out.x * 34, corner.y + corner.out.y * 34, 36, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = pattern ?? c.gravel;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 100;
    ctx.lineJoin = "round";
    racingLine(ctx, track);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // The racing line, as a dashed centreline (like the 2024 map's). Curved
  // through the waypoints (quadratic segments via their midpoints) rather
  // than joined by straight lines, so it bends smoothly through the rounded
  // corners instead of cutting across them as a crooked chord.
  ctx.save();
  ctx.strokeStyle = c.roadDash;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.lineJoin = "round";
  racingLine(ctx, track);
  ctx.stroke();
  ctx.restore();

  // Checkpoints: a hairline across the road, barely there (the next one is
  // marked by its gate; dark dashes here read as a drawing glitch).
  ctx.save();
  ctx.strokeStyle = c.roadDash;
  ctx.globalAlpha = 0.14;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const cp of track.checkpoints) {
    if (cp.width > cp.height) {
      ctx.moveTo(cp.x, cp.y + cp.height / 2);
      ctx.lineTo(cp.x + cp.width, cp.y + cp.height / 2);
    } else {
      ctx.moveTo(cp.x + cp.width / 2, cp.y);
      ctx.lineTo(cp.x + cp.width / 2, cp.y + cp.height);
    }
  }
  ctx.stroke();
  ctx.restore();

  // Grid slots painted on the asphalt: a line at the front of each slot (cars
  // face left) and two short arms back along its sides.
  ctx.save();
  ctx.strokeStyle = c.gridLine;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  const size = PHYSICS.carSize;
  for (let i = 0; i < 6; i++) {
    const g = gridPosition(track, i);
    const x = g.x + 1;
    const top = g.y + 3;
    const bottom = g.y + size - 3;
    ctx.beginPath();
    ctx.moveTo(x + 7, top);
    ctx.lineTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineTo(x + 7, bottom);
    ctx.stroke();
  }
  ctx.restore();

  // Finish line: a two-column chequer.
  const f = track.finishLine;
  const cell = f.width / 4;
  for (let row = 0; row * cell < f.height; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#1a1a1a" : "#f2f1ec";
      ctx.fillRect(f.x + col * cell, f.y + row * cell, cell, Math.min(cell, f.height - row * cell));
    }
  }

  ctx.strokeStyle = c.border;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  ctx.globalAlpha = 1;
}

/**
 * A faint darkening towards the edges of the map, so the track reads as a
 * framed picture set into the page rather than a cut-out pasted on it.
 */
export function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.45,
    width / 2,
    height / 2,
    Math.hypot(width, height) / 2,
  );
  g.addColorStop(0, "rgba(20, 24, 16, 0)");
  g.addColorStop(1, "rgba(20, 24, 16, 0.22)");
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** A soft contact shadow under things that sit on the road. */
function shadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  p: Palette,
) {
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A chunky lightning bolt centred on (cx, cy), `s` px tall. */
export function boltPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const k = s / 12;
  ctx.beginPath();
  ctx.moveTo(cx + 1 * k, cy - 6 * k);
  ctx.lineTo(cx - 3.5 * k, cy + 0.8 * k);
  ctx.lineTo(cx - 0.2 * k, cy + 0.8 * k);
  ctx.lineTo(cx - 1 * k, cy + 6 * k);
  ctx.lineTo(cx + 3.5 * k, cy - 0.8 * k);
  ctx.lineTo(cx + 0.2 * k, cy - 0.8 * k);
  ctx.closePath();
}

/** Standard overshoot easing: used for an item popping back onto the track. */
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};

/** The main colour of each item, for the particles it leaves behind. */
export const itemColors = (type: ItemSpawn["type"], p: Palette): [string, string] =>
  type === 1
    ? [p.accent, p.c.bolt]
    : type === 2
      ? [p.c.barrel, p.c.barrelHoop]
      : type === 3
        ? [p.c.log, p.c.logBark]
        : [p.c.cone, p.c.coneBand];

/**
 * Items in a flat, rounded 2D style: nitro is a glossy badge with a bolt that
 * floats a little (`bob`, −1…1); barrel and cone are seen from the side, the
 * log from above, all on soft shadows. `spawn` (0–1, just after it respawns)
 * pops the item in with a little overshoot instead of it just appearing.
 */
export function drawItem(
  ctx: CanvasRenderingContext2D,
  item: ItemSpawn,
  p: Palette,
  bob = 0,
  spawn: number | null = null,
  zoom = 1,
) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  const c = p.c;
  ctx.save();
  if (spawn !== null || zoom !== 1) {
    const scale = Math.max(0.05, spawn === null ? 1 : easeOutBack(spawn)) * zoom;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
  }
  if (item.type === 1) {
    const y = cy + bob * 1.5;
    shadow(ctx, cx, cy + 8, 6 - bob, 2, p);
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx, y, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(cx - 3, y - 3.5, 3.5, 2, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.bolt;
    boltPath(ctx, cx + 0.3, y + 0.3, 11);
    ctx.fill();
  } else if (item.type === 2) {
    // Barrel: chubby staves, two hoops, a shine, a lid.
    shadow(ctx, cx, cy + 8.5, 8.5, 2.2, p);
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 8.5);
      ctx.quadraticCurveTo(cx - 9, cy, cx - 6, cy + 8.5);
      ctx.lineTo(cx + 6, cy + 8.5);
      ctx.quadraticCurveTo(cx + 9, cy, cx + 6, cy - 8.5);
      ctx.closePath();
    };
    ctx.fillStyle = c.barrel;
    body();
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = c.barrelHoop;
    ctx.fillRect(cx - 9, cy - 5, 18, 2);
    ctx.fillRect(cx - 9, cy + 3, 18, 2);
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.28;
    ctx.fillRect(cx - 4.5, cy - 8.5, 2, 17);
    ctx.restore();
    ctx.fillStyle = c.barrelHoop;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8.5, 6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.barrel;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8.5, 4.6, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 3) {
    // Log: bark with two grooves, rings on the cut end. Lies along the long side.
    const vertical = item.height > item.width;
    const len = (vertical ? item.height : item.width) - 4;
    const thick = Math.min(12, (vertical ? item.width : item.height) - 6);
    ctx.translate(cx, cy);
    if (vertical) ctx.rotate(Math.PI / 2);
    shadow(ctx, 1, 3, len / 2, thick / 2, p);
    ctx.fillStyle = c.log;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -thick / 2, len, thick, thick / 2);
    ctx.fill();
    ctx.strokeStyle = c.logBark;
    ctx.lineWidth = 1.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-len / 2 + 5, -2);
    ctx.lineTo(len / 2 - 9, -2);
    ctx.moveTo(-len / 2 + 8, 2.2);
    ctx.lineTo(len / 2 - 12, 2.2);
    ctx.stroke();
    ctx.fillStyle = c.logEnd;
    ctx.beginPath();
    ctx.arc(len / 2 - thick / 2, 0, thick / 2 - 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c.logRing;
    ctx.beginPath();
    ctx.arc(len / 2 - thick / 2, 0, 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Cone: a rounded peak with a white band, on a flat base.
    shadow(ctx, cx, cy + 8.5, 9, 2.2, p);
    ctx.fillStyle = c.coneBase;
    ctx.beginPath();
    ctx.roundRect(cx - 8.5, cy + 6, 17, 3.5, 1.75);
    ctx.fill();
    const cone = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 6.5);
      ctx.lineTo(cx - 1.4, cy - 8);
      ctx.quadraticCurveTo(cx, cy - 10, cx + 1.4, cy - 8);
      ctx.lineTo(cx + 6, cy + 6.5);
      ctx.closePath();
    };
    ctx.fillStyle = c.cone;
    cone();
    ctx.fill();
    ctx.save();
    cone();
    ctx.clip();
    ctx.fillStyle = c.coneBand;
    ctx.fillRect(cx - 7, cy - 2.5, 14, 3.2);
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.25;
    ctx.fillRect(cx - 3.2, cy - 9, 1.6, 16);
    ctx.restore();
  }
  ctx.restore();
}

/** `highlight`: a white outline so you can always spot your own car. */
export type CarLook = { body: string; helmet: string; stripe: boolean; highlight?: boolean };

/** Darkens whatever was just filled with `path`: wings and the floor read as carbon. */
function darken(ctx: CanvasRenderingContext2D, path: () => void, amount: number) {
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.fillStyle = "#000000";
  path();
  ctx.fill();
  ctx.restore();
}

/**
 * A top-down open-wheel racer pointing where it drives (the engine faces
 * rotation + 180°), after the 2024 game's F1 sprite: wide front and rear
 * wings, wheels outside a narrow body with sidepods, a cockpit with the
 * driver's helmet. `boosted` lights the exhaust.
 */
export function drawCar(
  ctx: CanvasRenderingContext2D,
  car: Pick<Car, "x" | "y" | "width" | "height" | "rotation">,
  look: CarLook,
  p: Palette,
  boosted: boolean,
  zoom = 1,
) {
  const c = p.c;
  const cx = car.x + car.width / 2;
  const cy = car.y + car.height / 2;
  ctx.save();
  shadow(ctx, cx + zoom, cy + 2 * zoom, 12.5 * zoom, 7.5 * zoom, p);
  ctx.translate(cx, cy);
  ctx.rotate(((car.rotation + 180) * Math.PI) / 180);
  ctx.scale(zoom, zoom);

  if (boosted) {
    // A pointed, flickering exhaust flame: an outer spike in the site's blue,
    // a yellow one inside it and a white-hot core, each a different length.
    const flicker = 0.8 + 0.2 * Math.sin(performance.now() / 35) * Math.sin(performance.now() / 23);
    const spike = (length: number, width: number, color: string, alpha: number) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(-11.5, -width);
      ctx.lineTo(-11.5 - length * flicker, 0);
      ctx.lineTo(-11.5, width);
      ctx.closePath();
      ctx.fill();
    };
    spike(15, 3.2, p.accent, 0.75);
    spike(11, 2.2, c.bolt, 0.95);
    spike(6, 1.1, "#ffffff", 0.95);
    ctx.globalAlpha = 1;
  }

  // Wheels, outside the body: wider at the back.
  ctx.fillStyle = c.wheel;
  for (const [x, y, w, h] of [
    [-10, -9, 5.4, 3.6],
    [-10, 5.4, 5.4, 3.6],
    [5, -8.2, 4.6, 3],
    [5, 5.2, 4.6, 3],
  ] as const) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 1.2);
    ctx.fill();
  }
  // Suspension arms.
  ctx.strokeStyle = c.wheel;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-7.3, -5.4);
  ctx.lineTo(-7.3, 5.4);
  ctx.moveTo(7.3, -5.2);
  ctx.lineTo(7.3, 5.2);
  ctx.stroke();

  // Rear and front wings.
  const rearWing = () => {
    ctx.beginPath();
    ctx.roundRect(-12.5, -6.2, 2.4, 12.4, 0.8);
  };
  const frontWing = () => {
    ctx.beginPath();
    ctx.roundRect(9.6, -7, 2.2, 14, [0.6, 1.1, 1.1, 0.6]);
  };
  ctx.fillStyle = look.body;
  rearWing();
  ctx.fill();
  darken(ctx, rearWing, 0.35);
  frontWing();
  ctx.fill();
  darken(ctx, frontWing, 0.2);

  // Body: engine cover, sidepods, then a nose that narrows to the front wing.
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-11, -2.6);
    ctx.lineTo(-7.5, -4.6);
    ctx.quadraticCurveTo(-2, -5.4, 1, -4.2);
    ctx.lineTo(3, -2);
    ctx.lineTo(10.4, -1.3);
    ctx.quadraticCurveTo(11.4, 0, 10.4, 1.3);
    ctx.lineTo(3, 2);
    ctx.lineTo(1, 4.2);
    ctx.quadraticCurveTo(-2, 5.4, -7.5, 4.6);
    ctx.lineTo(-11, 2.6);
    ctx.closePath();
  };
  ctx.fillStyle = look.body;
  body();
  ctx.fill();
  if (look.highlight) {
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.4;
    body();
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  body();
  ctx.clip();
  // Livery: a stripe down the middle, and a light sheen on the near side.
  if (look.stripe) {
    ctx.fillStyle = c.stripe;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-11, -0.55, 23, 1.1);
  }
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.16;
  ctx.fillRect(-11, -6, 23, 2.6);
  ctx.restore();

  // Cockpit and helmet.
  ctx.fillStyle = "#000000";
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(-1.8, 0, 3.2, 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = look.helmet;
  ctx.beginPath();
  ctx.arc(-1.4, 0, 1.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.globalAlpha = 0.45;
  ctx.fillRect(-0.4, -1, 0.7, 2); // visor
  ctx.restore();
}

/**
 * The driver's name above the car, with one small bolt per nitro charge
 * beside it. Black outline, white text, so it reads on the grey road or the
 * green grass alike: `mine` (your own car) stands out at 0.9 opacity, bots
 * stay a little dimmer so yours is the one that pops. While nitro burns, a
 * thin bar between the name and the car empties with the time left (`boost`,
 * 1 → 0). Flips below the car at the top edge and stays inside the map at
 * the sides.
 */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  car: Pick<Car, "x" | "y" | "width" | "height">,
  name: string,
  nitro: number,
  p: Palette,
  mapWidth: number,
  boost: number | null,
  mine: boolean,
  zoom = 1,
) {
  ctx.save();
  ctx.font = `600 ${10 * Math.min(zoom, 1.2)}px ${p.font}`;
  const textWidth = ctx.measureText(name).width;
  const diamonds = nitro > 0 ? 4 + nitro * 7 : 0;
  const total = textWidth + diamonds;
  const x = Math.max(3, Math.min(mapWidth - total - 3, car.x + car.width / 2 - total / 2));
  const { y, barY } = labelPlace(car, boost !== null, zoom, 12);
  if (boost !== null) boostBar(ctx, car, barY, boost, p);

  ctx.globalAlpha = mine ? 0.9 : 0.6;
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = "#000000";
  ctx.strokeText(name, x, y);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, x, y);

  ctx.fillStyle = mine ? p.accent : p.c.bolt;
  for (let i = 0; i < nitro; i++) {
    boltPath(ctx, x + textWidth + 4 + 3 + i * 7, y - 3.5, 9);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Where a label goes: above the car, or below it at the top edge of the map;
 * the nitro bar (if any) sits between the label and the car. `zoom` is how
 * much bigger than its box the car is drawn (phones), `textHeight` the
 * label's height (its baseline is `y`).
 */
function labelPlace(
  car: Pick<Car, "y" | "height">,
  hasBar: boolean,
  zoom: number,
  textHeight: number,
) {
  const grow = ((zoom - 1) * car.height) / 2;
  const below = car.y < 22;
  const bar = hasBar ? 6 : 0;
  return {
    below,
    y: below ? car.y + car.height + grow + textHeight + bar : car.y - grow - 5 - bar,
    barY: below ? car.y + car.height + grow + 3 : car.y - grow - 7,
  };
}

/** The nitro left, as a thin bar that empties (`boost`, 1 → 0). */
function boostBar(
  ctx: CanvasRenderingContext2D,
  car: Pick<Car, "x" | "width">,
  y: number,
  boost: number,
  p: Palette,
) {
  const barWidth = 24;
  const bx = car.x + car.width / 2 - barWidth / 2;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = p.line;
  ctx.beginPath();
  ctx.roundRect(bx, y, barWidth, 3, 1.5);
  ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.roundRect(bx, y, Math.max(0, barWidth * boost), 3, 1.5);
  ctx.fill();
  ctx.restore();
}

/** Everyone else carries no label (05/10/2026), only the nitro bar while it burns. */
export function drawBoost(
  ctx: CanvasRenderingContext2D,
  car: Pick<Car, "x" | "y" | "width" | "height">,
  boost: number,
  p: Palette,
  zoom = 1,
) {
  boostBar(ctx, car, labelPlace(car, true, zoom, 0).barY, boost, p);
}

/**
 * Where to go next: a gate across the next checkpoint (or the finish line once
 * every checkpoint is done), a post at each end and a band between them that
 * pulses gently (`pulse`, 0–1). It stands on the track like the kerbs do,
 * instead of reading as a line drawn over the game.
 */
export function drawTarget(
  ctx: CanvasRenderingContext2D,
  box: Box,
  finish: boolean,
  p: Palette,
  pulse: number,
) {
  const across = box.width > box.height;
  // The finish gate stands on the chequer's right edge, where cars arrive.
  const lineX = finish ? box.x + box.width : box.x + box.width / 2;
  const [a, b] = across
    ? [
        { x: box.x, y: box.y + box.height / 2 },
        { x: box.x + box.width, y: box.y + box.height / 2 },
      ]
    : [
        { x: lineX, y: box.y },
        { x: lineX, y: box.y + box.height },
      ];
  ctx.save();
  ctx.lineCap = "round";
  const band = () => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  // A soft glow, a light core so it reads on the asphalt, then the dashes.
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 10;
  ctx.globalAlpha = 0.1 + 0.12 * pulse;
  band();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.25 + 0.15 * pulse;
  band();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = 0.55 + 0.4 * pulse;
  ctx.setLineDash([6, 5]);
  band();
  ctx.setLineDash([]);
  // The posts, on the kerbs at either end.
  for (const post of [a, b]) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.ellipse(post.x + 1.5, post.y + 2.5, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(post.x, post.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.45 + 0.45 * pulse;
    ctx.beginPath();
    ctx.arc(post.x - 1, post.y - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Position between two ticks, for smooth 60 fps drawing of a 30 ticks/s race. */
export function interpolateCar(prev: Car | undefined, next: Car, t: number) {
  if (!prev) return next;
  // A jump back to the start (left the map) shouldn't be smoothed.
  if (Math.abs(prev.x - next.x) > 40 || Math.abs(prev.y - next.y) > 40) return next;
  let dr = next.rotation - prev.rotation;
  if (dr > 180) dr -= 360;
  if (dr < -180) dr += 360;
  return {
    ...next,
    x: lerp(prev.x, next.x, t),
    y: lerp(prev.y, next.y, t),
    rotation: prev.rotation + dr * t,
  };
}
