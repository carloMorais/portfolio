import type { Box, Car, ItemSpawn, Track } from "race-engine";

/** The site's colour tokens, read from CSS so the track follows light/dark mode. */
export type Palette = {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  /** The page's text font, for labels drawn on the canvas. */
  font: string;
  /** Whichever of paper and ink is lighter: the colour of a hit flash. */
  light: string;
};

export function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    font: css.fontFamily,
    light: dark ? v("--ink") : v("--bg"),
    bg: v("--bg"),
    surface: v("--surface"),
    ink: v("--ink"),
    muted: v("--muted"),
    line: v("--line"),
    accent: v("--accent"),
  };
}

/**
 * The track, drawn from the engine's own collision boxes so what you see is
 * exactly what you hit: the road is paper, everything off it is hatched like
 * the site's photo placeholders, and the racing line is a faint dashed path.
 */
export function drawTrack(ctx: CanvasRenderingContext2D, track: Track, p: Palette) {
  const { width, height } = track;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, width, height);

  // A soft kerb: the walls, grown by a pixel and a half, in the line colour.
  ctx.fillStyle = p.line;
  for (const w of track.walls) ctx.fillRect(w.x - 1.5, w.y - 1.5, w.width + 3, w.height + 3);

  // Off-track: surface with a fine diagonal hatch, clipped to the walls.
  ctx.save();
  ctx.beginPath();
  for (const w of track.walls) ctx.rect(w.x, w.y, w.width, w.height);
  ctx.clip();
  ctx.fillStyle = p.surface;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let d = -height; d < width; d += 9) {
    ctx.moveTo(d, height);
    ctx.lineTo(d + height, 0);
  }
  ctx.stroke();
  ctx.restore();

  // Racing line.
  ctx.save();
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.lineJoin = "round";
  ctx.beginPath();
  track.waypoints.forEach((wp, i) => (i === 0 ? ctx.moveTo(wp.x, wp.y) : ctx.lineTo(wp.x, wp.y)));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Checkpoints: a thin dashed line across the road (the box is just its hit area).
  ctx.save();
  ctx.strokeStyle = p.muted;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
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

  // Finish line: a two-column chequer.
  const f = track.finishLine;
  const cell = f.width / 4;
  for (let row = 0; row * cell < f.height; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? p.ink : p.bg;
      ctx.fillRect(f.x + col * cell, f.y + row * cell, cell, Math.min(cell, f.height - row * cell));
    }
  }

  // Borders: a thin ink outline around the whole map.
  ctx.strokeStyle = p.muted;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
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
  ctx.globalAlpha = 0.12;
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

/**
 * Items in a flat, rounded, top-down style: nitro is a glossy badge with a
 * bolt that floats a little (`bob`, −1…1), the obstacles sit on soft shadows.
 */
export function drawItem(ctx: CanvasRenderingContext2D, item: ItemSpawn, p: Palette, bob = 0) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  ctx.save();
  if (item.type === 1) {
    const y = cy + bob * 1.5;
    shadow(ctx, cx, cy + 8, 6 - bob, 2, p);
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx, y, 8.5, 0, Math.PI * 2);
    ctx.fill();
    // Gloss on the top left.
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.ellipse(cx - 3, y - 3.5, 3.5, 2, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.bg;
    boltPath(ctx, cx + 0.3, y + 0.3, 11);
    ctx.fill();
  } else if (item.type === 2) {
    // Barrel, a little from the side: chubby staves, two hoops, a shine.
    shadow(ctx, cx, cy + 8.5, 8.5, 2.2, p);
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 8.5);
      ctx.quadraticCurveTo(cx - 9, cy, cx - 6, cy + 8.5);
      ctx.lineTo(cx + 6, cy + 8.5);
      ctx.quadraticCurveTo(cx + 9, cy, cx + 6, cy - 8.5);
      ctx.closePath();
    };
    ctx.fillStyle = p.muted;
    body();
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = p.ink;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(cx - 9, cy - 5, 18, 2);
    ctx.fillRect(cx - 9, cy + 3, 18, 2);
    ctx.fillStyle = p.bg;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(cx - 4.5, cy - 8.5, 2, 17);
    ctx.restore();
    // Lid.
    ctx.fillStyle = p.muted;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8.5, 6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.bg;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8.5, 4.5, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 3) {
    // Log: bark with two grooves, rings on the cut end. Lies along the long side.
    const vertical = item.height > item.width;
    const len = (vertical ? item.height : item.width) - 4;
    const thick = Math.min(12, (vertical ? item.width : item.height) - 6);
    ctx.translate(cx, cy);
    if (vertical) ctx.rotate(Math.PI / 2);
    shadow(ctx, 1, 3, len / 2, thick / 2, p);
    ctx.fillStyle = p.muted;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -thick / 2, len, thick, thick / 2);
    ctx.fill();
    ctx.strokeStyle = p.ink;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-len / 2 + 5, -2);
    ctx.lineTo(len / 2 - 9, -2);
    ctx.moveTo(-len / 2 + 8, 2.2);
    ctx.lineTo(len / 2 - 12, 2.2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.surface;
    ctx.beginPath();
    ctx.arc(len / 2 - thick / 2, 0, thick / 2 - 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.muted;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(len / 2 - thick / 2, 0, 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Cone, from the side: a rounded peak with a paper band on a flat base.
    shadow(ctx, cx, cy + 8.5, 9, 2.2, p);
    ctx.fillStyle = p.muted;
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
    ctx.fillStyle = p.ink;
    cone();
    ctx.fill();
    ctx.save();
    cone();
    ctx.clip();
    ctx.fillStyle = p.bg;
    ctx.fillRect(cx - 7, cy - 2.5, 14, 3.2);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(cx - 3.2, cy - 9, 1.6, 16);
    ctx.restore();
  }
  ctx.restore();
}

export type CarLook = { body: string; stripe: boolean };

/**
 * A small, rounded top-down car pointing where it drives (the engine faces
 * rotation + 180°): wheels peeking out, a roof, windscreen and headlights.
 * `flash` (0–1) washes it in light for a hit; `boosted` adds a flame.
 */
export function drawCar(
  ctx: CanvasRenderingContext2D,
  car: Pick<Car, "x" | "y" | "width" | "height" | "rotation">,
  look: CarLook,
  p: Palette,
  boosted: boolean,
  flash = 0,
) {
  const cx = car.x + car.width / 2;
  const cy = car.y + car.height / 2;
  ctx.save();
  shadow(ctx, cx + 1, cy + 2.5, 12, 8.5, p);
  ctx.translate(cx, cy);
  ctx.rotate(((car.rotation + 180) * Math.PI) / 180);

  if (boosted) {
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-10.5, -3.5);
    ctx.quadraticCurveTo(-19, 0, -10.5, 3.5);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Wheels.
  ctx.fillStyle = p.ink;
  for (const [x, y] of [
    [-7, -7.2],
    [5, -7.2],
    [-7, 4.2],
    [5, 4.2],
  ] as const) {
    ctx.beginPath();
    ctx.roundRect(x, y, 5.5, 3, 1.5);
    ctx.fill();
  }

  // Body: a pill with a slightly rounder nose.
  const body = () => {
    ctx.beginPath();
    ctx.roundRect(-11, -6.5, 22, 13, [5, 6.5, 6.5, 5]);
  };
  ctx.fillStyle = look.body;
  body();
  ctx.fill();
  if (look.stripe) {
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = p.bg;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(-11, -1.3, 22, 2.6);
    ctx.restore();
  }

  // Roof and windscreen.
  ctx.fillStyle = p.bg;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.roundRect(-5.5, -4.5, 9, 9, 3);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.roundRect(3, -4.5, 3.5, 9, [1, 2.5, 2.5, 1]);
  ctx.fill();
  // Headlights.
  ctx.globalAlpha = 0.95;
  for (const y of [-3.8, 3.8]) {
    ctx.beginPath();
    ctx.arc(9.3, y, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  if (flash > 0) {
    ctx.globalAlpha = Math.min(1, flash) * 0.85;
    ctx.fillStyle = p.light;
    body();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The driver's name above the car, faint so it never hides the track, with
 * one small bolt per nitro charge beside it. While nitro burns, a thin bar
 * between the name and the car empties with the time left (`boost`, 1 → 0).
 * Flips below the car at the top edge and stays inside the map at the sides.
 */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  car: Pick<Car, "x" | "y" | "width" | "height">,
  name: string,
  nitro: number,
  p: Palette,
  mapWidth: number,
  boost: number | null,
) {
  ctx.save();
  ctx.font = `500 10px ${p.font}`;
  const textWidth = ctx.measureText(name).width;
  const diamonds = nitro > 0 ? 4 + nitro * 7 : 0;
  const total = textWidth + diamonds;
  const x = Math.max(3, Math.min(mapWidth - total - 3, car.x + car.width / 2 - total / 2));
  const below = car.y < 22;
  const bar = boost === null ? 0 : 6;
  const y = below ? car.y + car.height + 12 + bar : car.y - 5 - bar;

  if (boost !== null) {
    const barWidth = 24;
    const bx = car.x + car.width / 2 - barWidth / 2;
    const by = below ? car.y + car.height + 3 : car.y - 7;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = p.line;
    ctx.beginPath();
    ctx.roundRect(bx, by, barWidth, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.roundRect(bx, by, Math.max(0, barWidth * boost), 3, 1.5);
    ctx.fill();
  }

  ctx.globalAlpha = 0.65;
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.bg;
  ctx.strokeText(name, x, y);
  ctx.fillStyle = p.ink;
  ctx.fillText(name, x, y);

  ctx.fillStyle = p.accent;
  for (let i = 0; i < nitro; i++) {
    boltPath(ctx, x + textWidth + 4 + 3 + i * 7, y - 3.5, 9);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Where to go next: the next checkpoint's line, or the finish line once every
 * checkpoint is done, in the accent colour and gently pulsing (`pulse`, 0–1).
 */
export function drawTarget(
  ctx: CanvasRenderingContext2D,
  box: Box,
  finish: boolean,
  p: Palette,
  pulse: number,
) {
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.45 + 0.45 * pulse;
  if (finish) {
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x - 2, box.y - 2, box.width + 4, box.height + 4);
  } else {
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    if (box.width > box.height) {
      ctx.moveTo(box.x, box.y + box.height / 2);
      ctx.lineTo(box.x + box.width, box.y + box.height / 2);
    } else {
      ctx.moveTo(box.x + box.width / 2, box.y);
      ctx.lineTo(box.x + box.width / 2, box.y + box.height);
    }
    ctx.stroke();
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
