import type { Car, ItemSpawn, Track } from "race-engine";

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
};

export function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    font: css.fontFamily,
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

export function drawItem(ctx: CanvasRenderingContext2D, item: ItemSpawn, p: Palette) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  ctx.save();
  if (item.type === 1) {
    // Nitro: an accent diamond.
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx + 7, cy);
    ctx.lineTo(cx, cy + 9);
    ctx.lineTo(cx - 7, cy);
    ctx.closePath();
    ctx.fill();
  } else if (item.type === 2) {
    // Barrel: a ringed circle.
    ctx.fillStyle = p.muted;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.bg;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Log: a rounded bar with end grain.
    ctx.fillStyle = p.muted;
    ctx.beginPath();
    ctx.roundRect(item.x + 2, cy - 6, item.width - 4, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.arc(item.x + item.width - 7, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A small top-down car, pointing where it drives (the engine faces rotation + 180°). */
export function drawCar(
  ctx: CanvasRenderingContext2D,
  car: Pick<Car, "x" | "y" | "width" | "height" | "rotation">,
  body: string,
  p: Palette,
  boosted: boolean,
) {
  const cx = car.x + car.width / 2;
  const cy = car.y + car.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((car.rotation + 180) * Math.PI) / 180);
  if (boosted) {
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(-11, -4);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-11, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-11, -6.5, 22, 13, 4);
  ctx.fill();
  // Windscreen, towards the nose.
  ctx.fillStyle = p.bg;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.roundRect(2, -4.5, 4.5, 9, 1.5);
  ctx.fill();
  ctx.restore();
}

/**
 * The driver's name above the car, faint so it never hides the track, with
 * one small diamond per nitro charge beside it. Flips below the car at the
 * top edge and stays inside the map at the sides.
 */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  car: Pick<Car, "x" | "y" | "width" | "height">,
  name: string,
  nitro: number,
  p: Palette,
  mapWidth: number,
) {
  ctx.save();
  ctx.font = `500 10px ${p.font}`;
  const textWidth = ctx.measureText(name).width;
  const diamonds = nitro > 0 ? 4 + nitro * 7 : 0;
  const total = textWidth + diamonds;
  const x = Math.max(3, Math.min(mapWidth - total - 3, car.x + car.width / 2 - total / 2));
  const y = car.y < 16 ? car.y + car.height + 12 : car.y - 5;

  ctx.globalAlpha = 0.65;
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.bg;
  ctx.strokeText(name, x, y);
  ctx.fillStyle = p.ink;
  ctx.fillText(name, x, y);

  ctx.fillStyle = p.accent;
  for (let i = 0; i < nitro; i++) {
    const cx = x + textWidth + 4 + 3 + i * 7;
    const cy = y - 3.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(cx - 3, cy);
    ctx.closePath();
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
