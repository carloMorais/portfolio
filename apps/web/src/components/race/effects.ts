import { ITEM_KINDS, type Box, type ItemSpawn } from "race-engine";
import { itemColors, type Palette } from "./draw";

/**
 * Short-lived visual effects drawn under the cars, timed in milliseconds (not
 * ticks) so they stay smooth at any frame rate. Inspired by the 2024 game,
 * which burst picked items into 4 px squares and left a trail of shrinking
 * circles behind a car on nitro. Here:
 * - soft items (nitro, cone) burst into round bits in their colours;
 * - rigid ones (barrel, log) shatter: spinning shards, a crack ring, dust;
 * - wall hits puff dust off the wall, and strong ones throw sparks;
 * - hitting an obstacle flashes a little impact star where the two touched;
 * - an item coming back onto the track pops in with a ring (see `draw.ts`'s
 *   overshoot scale, driven by `respawnProgress`);
 * - nitro leaves a long, glowing trail;
 * - hard corners and heavy braking leave tyre marks that fade over a few
 *   seconds, and pulling away from a standstill puffs a little exhaust.
 * With reduced motion none of this is drawn.
 */

type Particle = {
  kind: "dot" | "square" | "puff" | "shard" | "spark";
  x: number;
  y: number;
  /** px per ms */
  vx: number;
  vy: number;
  size: number;
  color: string;
  born: number;
  life: number;
  alpha: number;
  /** Shards: starting angle, spin (rad per ms) and shape. */
  angle?: number;
  spin?: number;
  points?: [number, number][];
};
/** An impact star: short rays and a bright core where a car met an obstacle. */
type Impact = { x: number; y: number; born: number; angle: number };
const IMPACT_MS = 240;

type Ring = { x: number; y: number; color: string; born: number; life: number; radius: number };

const TRAIL_EVERY_MS = 18;
const TRAIL_MS = 650;
/** Tyre marks stay this long, fading out. */
const SKID_MS = 4000;
const MAX_SKIDS = 1200;
const EXHAUST_EVERY_MS = 90;

type Skid = { x1: number; y1: number; x2: number; y2: number; born: number };
type Point = { x: number; y: number };
type CarPose = Box & { rotation: number };

/** Where a car's two rear wheels are, in map coordinates. */
function rearWheels(car: CarPose): [Point, Point] {
  const facing = ((car.rotation + 180) * Math.PI) / 180;
  const cx = car.x + car.width / 2 - Math.cos(facing) * 8;
  const cy = car.y + car.height / 2 - Math.sin(facing) * 8;
  const px = -Math.sin(facing) * 7;
  const py = Math.cos(facing) * 7;
  return [
    { x: cx + px, y: cy + py },
    { x: cx - px, y: cy - py },
  ];
}
const RESPAWN_MS = 420;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export class Effects {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private impacts: Impact[] = [];
  private respawns = new Map<string, number>();
  private lastTrail = new Map<string, number>();
  private skids: Skid[] = [];
  private wheels = new Map<string, [Point, Point]>();
  private lastExhaust = new Map<string, number>();

  constructor(private readonly reduced: boolean) {}

  clear() {
    this.particles = [];
    this.rings = [];
    this.impacts = [];
    this.respawns.clear();
    this.lastTrail.clear();
    this.skids = [];
    this.wheels.clear();
    this.lastExhaust.clear();
  }

  /**
   * Called every tick for every car: while it `skids` (a hard turn at speed,
   * heavy braking) its rear wheels leave two dark marks on the road.
   */
  tyres(id: string, car: CarPose, skids: boolean, now: number) {
    if (this.reduced) return;
    const next = rearWheels(car);
    const last = this.wheels.get(id);
    this.wheels.set(id, next);
    if (!skids || !last) return;
    // A respawn or a teleport is not a skid.
    if (Math.hypot(next[0].x - last[0].x, next[0].y - last[0].y) > 20) return;
    for (const i of [0, 1] as const) {
      this.skids.push({ x1: last[i].x, y1: last[i].y, x2: next[i].x, y2: next[i].y, born: now });
    }
    if (this.skids.length > MAX_SKIDS) this.skids.splice(0, this.skids.length - MAX_SKIDS);
  }

  /** Pulling away from a standstill: a small grey puff behind the car. */
  exhaust(id: string, car: CarPose, now: number) {
    if (this.reduced || now - (this.lastExhaust.get(id) ?? 0) < EXHAUST_EVERY_MS) return;
    this.lastExhaust.set(id, now);
    const facing = ((car.rotation + 180) * Math.PI) / 180;
    this.particles.push({
      kind: "puff",
      x: car.x + car.width / 2 - Math.cos(facing) * 14 + rand(-1.5, 1.5),
      y: car.y + car.height / 2 - Math.sin(facing) * 14 + rand(-1.5, 1.5),
      vx: -Math.cos(facing) * 0.02 + rand(-0.01, 0.01),
      vy: -Math.sin(facing) * 0.02 + rand(-0.01, 0.01),
      size: rand(2, 3),
      color: "#9a9890",
      born: now,
      life: rand(500, 750),
      alpha: 0.4,
    });
  }

  /** Tyre marks: drawn first, flat on the road, under everything else. */
  drawSkids(ctx: CanvasRenderingContext2D, now: number) {
    if (this.skids.length === 0) return;
    this.skids = this.skids.filter((sk) => now - sk.born < SKID_MS);
    ctx.save();
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    for (const sk of this.skids) {
      const t = (now - sk.born) / SKID_MS;
      ctx.globalAlpha = 0.3 * (1 - t * t);
      ctx.beginPath();
      ctx.moveTo(sk.x1, sk.y1);
      ctx.lineTo(sk.x2, sk.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** An item came back: a quick ring, and `drawItem` pops it in (see `respawnProgress`). */
  respawn(item: ItemSpawn, p: Palette, now: number) {
    this.respawns.set(item.id, now);
    if (this.reduced) return;
    const [main] = itemColors(item.type, p);
    this.rings.push({
      x: item.x + item.width / 2,
      y: item.y + item.height / 2,
      color: main,
      born: now,
      life: RESPAWN_MS,
      radius: 16,
    });
  }

  /** 0–1 while `item` is popping back in, or null once it's settled. */
  respawnProgress(id: string, now: number): number | null {
    const born = this.respawns.get(id);
    if (born === undefined) return null;
    const t = (now - born) / RESPAWN_MS;
    if (t >= 1) {
      this.respawns.delete(id);
      return null;
    }
    return t;
  }

  /** Where a car met an obstacle (the middle of their overlap): a quick impact star. */
  impact(x: number, y: number, now: number) {
    if (this.reduced) return;
    this.impacts.push({ x, y, born: now, angle: rand(0, Math.PI) });
  }

  /** An item picked up: rigid ones shatter, soft ones burst. */
  pickup(item: ItemSpawn, p: Palette, now: number) {
    if (this.reduced) return;
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const [main, second] = itemColors(item.type, p);
    if (ITEM_KINDS[item.type].rigid) this.shatter(cx, cy, main, second, p, now);
    else this.burst(cx, cy, main, second, item.type === 1, now);
  }

  private burst(cx: number, cy: number, main: string, second: string, ring: boolean, now: number) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand(0, 0.4);
      const speed = rand(0.05, 0.12);
      this.particles.push({
        kind: "dot",
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rand(2, 3.2),
        color: i % 3 === 0 ? second : main,
        born: now,
        life: rand(420, 620),
        alpha: 0.95,
      });
    }
    if (ring) this.rings.push({ x: cx, y: cy, color: main, born: now, life: 450, radius: 22 });
  }

  /** Something hard breaking: angular shards that spin away, a crack ring, a puff. */
  private shatter(cx: number, cy: number, main: string, second: string, p: Palette, now: number) {
    const count = 9;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand(-0.25, 0.25);
      const speed = rand(0.07, 0.15);
      const s = rand(2.5, 4.5);
      // An irregular triangle around the origin.
      const points: [number, number][] = [
        [rand(-s, -s / 3), rand(-s, s)],
        [rand(s / 3, s), rand(-s, 0)],
        [rand(-s / 3, s / 2), rand(s / 3, s)],
      ];
      this.particles.push({
        kind: "shard",
        x: cx + Math.cos(angle) * 3,
        y: cy + Math.sin(angle) * 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: s,
        color: i % 3 === 0 ? second : main,
        born: now,
        life: rand(520, 760),
        alpha: 1,
        angle: rand(0, Math.PI * 2),
        spin: rand(-0.02, 0.02),
        points,
      });
    }
    // Splinters: thin, fast, short-lived.
    for (let i = 0; i < 6; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(0.14, 0.22);
      this.particles.push({
        kind: "spark",
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rand(3, 5),
        color: second,
        born: now,
        life: rand(220, 320),
        alpha: 0.9,
      });
    }
    this.puffs(cx, cy, 0, 0, 4, p, now);
    this.rings.push({ x: cx, y: cy, color: p.c.stripe, born: now, life: 220, radius: 14 });
  }

  /** Soft dust clouds that grow and fade, drifting away from (nx, ny). */
  private puffs(
    x: number,
    y: number,
    nx: number,
    ny: number,
    count: number,
    p: Palette,
    now: number,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const drift = rand(0.008, 0.025);
      this.particles.push({
        kind: "puff",
        x: x + rand(-2, 2),
        y: y + rand(-2, 2),
        vx: -nx * 0.02 + Math.cos(angle) * drift,
        vy: -ny * 0.02 + Math.sin(angle) * drift,
        size: rand(3, 5),
        color: p.c.dust,
        born: now,
        life: rand(450, 700),
        alpha: 0.55,
      });
    }
  }

  /** A wall hit: dust off the wall, more the harder it was; sparks on a big one. */
  bump(car: Box, impact: number, nx: number, ny: number, gate: boolean, p: Palette, now: number) {
    // Checkpoints are lines on the road: nothing to kick up there.
    if (impact < 1.2 || gate || this.reduced) return;
    const x = car.x + car.width / 2 + (nx * car.width) / 2;
    const y = car.y + car.height / 2 + (ny * car.height) / 2;
    this.puffs(x, y, nx, ny, Math.round(Math.min(5, 1 + impact * 0.7)), p, now);
    const bits = Math.round(Math.min(8, impact * 1.3));
    for (let i = 0; i < bits; i++) {
      // Spray back from the wall, spread sideways along it.
      const along = rand(-0.08, 0.08);
      const back = rand(0.03, 0.08);
      this.particles.push({
        kind: "square",
        x,
        y,
        vx: -nx * back + (nx === 0 ? along : 0),
        vy: -ny * back + (ny === 0 ? along : 0),
        size: rand(1.5, 2.8),
        color: p.c.dust,
        born: now,
        life: rand(350, 550),
        alpha: 0.85,
      });
    }
    if (impact >= 3) {
      for (let i = 0; i < 4; i++) {
        const along = rand(-0.12, 0.12);
        const back = rand(0.08, 0.14);
        this.particles.push({
          kind: "spark",
          x,
          y,
          vx: -nx * back + (nx === 0 ? along : 0),
          vy: -ny * back + (ny === 0 ? along : 0),
          size: rand(3, 5),
          color: p.c.spark,
          born: now,
          life: rand(160, 260),
          alpha: 1,
        });
      }
    }
  }

  /** Called every frame for a car on nitro: warm circles that shrink behind it, over a soft blue glow. */
  trail(id: string, car: CarPose, p: Palette, now: number) {
    if (this.reduced || now - (this.lastTrail.get(id) ?? 0) < TRAIL_EVERY_MS) return;
    this.lastTrail.set(id, now);
    const facing = ((car.rotation + 180) * Math.PI) / 180;
    const rearX = car.x + car.width / 2 - Math.cos(facing) * 12;
    const rearY = car.y + car.height / 2 - Math.sin(facing) * 12;
    this.particles.push({
      kind: "dot",
      x: rearX + rand(-2, 2),
      y: rearY + rand(-2, 2),
      vx: -Math.cos(facing) * 0.03,
      vy: -Math.sin(facing) * 0.03,
      size: rand(4, 6),
      color: Math.random() < 0.6 ? p.c.bolt : p.accent,
      born: now,
      life: TRAIL_MS,
      alpha: 0.7,
    });
    this.particles.push({
      kind: "dot",
      x: rearX,
      y: rearY,
      vx: -Math.cos(facing) * 0.015,
      vy: -Math.sin(facing) * 0.015,
      size: rand(7, 9),
      color: p.accent,
      born: now,
      life: TRAIL_MS * 0.8,
      alpha: 0.18,
    });
  }

  /** Particles and rings: drawn under the cars. */
  draw(ctx: CanvasRenderingContext2D, now: number) {
    ctx.save();
    this.particles = this.particles.filter((pt) => {
      const age = now - pt.born;
      const t = age / pt.life;
      if (t >= 1) return false;
      // Everything slows down as it goes (ease-out).
      const travel = age * (1 - t / 2);
      const x = pt.x + pt.vx * travel;
      const y = pt.y + pt.vy * travel;
      ctx.fillStyle = pt.color;
      ctx.strokeStyle = pt.color;
      if (pt.kind === "puff") {
        ctx.globalAlpha = pt.alpha * (1 - t) ** 1.5;
        ctx.beginPath();
        ctx.arc(x, y, pt.size * (1 + t * 1.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === "dot") {
        ctx.globalAlpha = pt.alpha * (1 - t);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0, pt.size * (1 - t)), 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === "square") {
        ctx.globalAlpha = pt.alpha * (1 - t);
        ctx.fillRect(x - pt.size / 2, y - pt.size / 2, pt.size, pt.size);
      } else if (pt.kind === "spark") {
        // A short streak along its own motion.
        const len = pt.size * (1 - t);
        const speed = Math.hypot(pt.vx, pt.vy) || 1;
        ctx.globalAlpha = pt.alpha * (1 - t);
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - (pt.vx / speed) * len, y - (pt.vy / speed) * len);
        ctx.stroke();
      } else {
        // Shard: solid until 60% of its life, then fades and shrinks a little.
        ctx.globalAlpha = t < 0.6 ? pt.alpha : pt.alpha * (1 - (t - 0.6) / 0.4);
        const scale = 1 - t * 0.3;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pt.angle! + pt.spin! * travel);
        ctx.scale(scale, scale);
        ctx.beginPath();
        pt.points!.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      return true;
    });

    this.rings = this.rings.filter((r) => {
      const t = (now - r.born) / r.life;
      if (t >= 1) return false;
      ctx.globalAlpha = 0.6 * (1 - t);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2 * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + r.radius * (1 - (1 - t) ** 3), 0, Math.PI * 2);
      ctx.stroke();
      return true;
    });

    ctx.restore();
  }

  /** Impact stars: drawn over the cars, where the hit was. */
  drawImpacts(ctx: CanvasRenderingContext2D, p: Palette, now: number) {
    ctx.save();
    this.impacts = this.impacts.filter((im) => {
      const t = (now - im.born) / IMPACT_MS;
      if (t >= 1) return false;
      const out = 1 - (1 - t) ** 3; // fast out, then hold
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = p.c.spark;
      ctx.lineCap = "round";
      ctx.lineWidth = 2 * (1 - t) + 0.6;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = im.angle + (i / 8) * Math.PI * 2;
        const long = i % 2 === 0 ? 10 : 6;
        const from = 2 + out * 3;
        const to = from + long * (0.4 + out * 0.6);
        ctx.moveTo(im.x + Math.cos(a) * from, im.y + Math.sin(a) * from);
        ctx.lineTo(im.x + Math.cos(a) * to, im.y + Math.sin(a) * to);
      }
      ctx.stroke();
      ctx.fillStyle = p.c.stripe;
      ctx.beginPath();
      ctx.arc(im.x, im.y, 3.5 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.restore();
  }
}
