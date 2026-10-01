import type { Box } from "./types.ts";

const INF = 1e20;

/**
 * Squared Euclidean distance transform in one dimension (Felzenszwalb &
 * Huttenlocher): `f` holds 0 on the set and INF elsewhere, `out` gets the
 * squared distance of each cell to the nearest set cell.
 */
function edt1d(f: Float64Array, n: number, out: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s: number;
    for (;;) {
      const p = v[k]!;
      s = (f[q]! + q * q - (f[p]! + p * p)) / (2 * q - 2 * p);
      if (s > z[k]!) break;
      k--;
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const p = v[k]!;
    out[q] = (q - p) * (q - p) + f[p]!;
  }
}

/** Squared distance from every cell to the nearest cell where `set` is 1. */
function distanceTo(set: Uint8Array, w: number, h: number): Float64Array {
  const d = new Float64Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = set[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const out = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = d[y * w + x]!;
    edt1d(f, h, out, v, z);
    for (let y = 0; y < h; y++) d[y * w + x] = out[y]!;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = d[y * w + x]!;
    edt1d(f, w, out, v, z);
    for (let x = 0; x < w; x++) d[y * w + x] = out[x]!;
  }
  return d;
}

const select = (d: Float64Array, test: (dist2: number) => boolean) => {
  const s = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) s[i] = test(d[i]!) ? 1 : 0;
  return s;
};
const invert = (s: Uint8Array) => s.map((b) => 1 - b);

/**
 * Rounds the corners of a track made of rectangles, approximating curves with
 * 1 px collision boxes (the engine only knows boxes).
 *
 * - `outer`: radius of the road's outside corners (where two walls meet in an
 *   L). The road is opened (eroded, then dilated) by this radius, so it must
 *   be under half the narrowest lane.
 * - `inner`: radius of wall tips sticking into the road (inside corners of a
 *   turn). The road is closed by this radius, so it must be under half the
 *   thinnest wall, or that wall would vanish.
 *
 * Deterministic (integer grid, same arithmetic everywhere), so browser and
 * server build exactly the same walls.
 */
export function roundCorners(
  walls: Box[],
  width: number,
  height: number,
  { outer, inner }: { outer: number; inner: number },
): Box[] {
  const w = width;
  const h = height;
  // A cell is road unless its centre is inside a wall; the map's edge is wall.
  const road = new Uint8Array(w * h).fill(1);
  for (const b of walls) {
    for (let y = Math.max(0, b.y); y < Math.min(h, b.y + b.height); y++) {
      road.fill(0, y * w + Math.max(0, b.x), y * w + Math.min(w, b.x + b.width));
    }
  }
  for (let x = 0; x < w; x++) road[x] = road[(h - 1) * w + x] = 0;
  for (let y = 0; y < h; y++) road[y * w] = road[y * w + w - 1] = 0;

  // Opening: drop road closer than `outer` to a wall, then grow it back.
  const core = select(distanceTo(invert(road), w, h), (d) => d > outer * outer);
  const opened = select(distanceTo(core, w, h), (d) => d <= outer * outer);
  // Closing: grow the road by `inner`, then shrink it back.
  const grown = select(distanceTo(opened, w, h), (d) => d <= inner * inner);
  const rounded = select(distanceTo(invert(grown), w, h), (d) => d > inner * inner);

  return toBoxes(rounded, w, h);
}

/** Wall cells (road = 0) as boxes: runs per row, merged down while identical. */
function toBoxes(road: Uint8Array, w: number, h: number): Box[] {
  const boxes: Box[] = [];
  let open = new Map<string, Box>();
  for (let y = 0; y < h; y++) {
    const next = new Map<string, Box>();
    let x = 0;
    while (x < w) {
      if (road[y * w + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < w && !road[y * w + x]) x++;
      const key = `${start}:${x}`;
      const box = open.get(key);
      if (box) {
        box.height += 1;
        next.set(key, box);
        open.delete(key);
      } else {
        const fresh = { x: start, y, width: x - start, height: 1 };
        boxes.push(fresh);
        next.set(key, fresh);
      }
    }
    open = next;
  }
  return boxes;
}
