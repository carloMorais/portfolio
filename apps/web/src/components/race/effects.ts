import type { Box, ItemSpawn } from "race-engine";
import type { Palette } from "./draw";

/**
 * Short-lived visual effects drawn over the race, all timed in milliseconds
 * (not ticks) so they stay smooth at any frame rate. Inspired by the 2024
 * game, which burst picked items into 4 px squares and left a trail of
 * shrinking circles behind a car on nitro; here the bursts follow the item's
 * colour, wall hits kick up dust and flash the car, and pickups float a label.
 * With reduced motion only the labels show, without moving.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: "square" | "circle";
  born: number;
  life: number;
  alpha: number;
};
type Ring = { x: number; y: number; color: string; born: number; life: number; radius: number };
/** A label that rides above a car. */
type Floater = { id: string; text: string; color: string; born: number; life: number };
/** Where a car is drawn this frame (its top-left corner and width). */
export type Locate = (id: string) => { x: number; y: number; width: number } | undefined;
type Hit = { born: number; strength: number };

const HIT_MS = 280;
const TRAIL_EVERY_MS = 18;

export class Effects {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private floaters: Floater[] = [];
  private hits = new Map<string, Hit>();
  private lastTrail = new Map<string, number>();

  constructor(private readonly reduced: boolean) {}

  clear() {
    this.particles = [];
    this.rings = [];
    this.floaters = [];
    this.hits.clear();
    this.lastTrail.clear();
  }

  /** An item picked up: it bursts outwards; for your car, a label says what it did. */
  pickup(item: ItemSpawn, id: string, mine: boolean, p: Palette, now: number) {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const nitro = item.type === 1;
    if (!this.reduced) {
      const count = nitro ? 14 : 18;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 0.06 + Math.random() * 0.08;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: nitro ? 3 : 2.5 + Math.random() * 2,
          color: nitro ? p.accent : p.muted,
          shape: nitro ? "circle" : "square",
          born: now,
          life: 420 + Math.random() * 200,
          alpha: 0.9,
        });
      }
      if (nitro)
        this.rings.push({ x: cx, y: cy, color: p.accent, born: now, life: 450, radius: 22 });
    }
    if (mine) {
      this.floaters.push({
        id,
        text: nitro ? "+1" : "−70%",
        color: nitro ? p.accent : p.ink,
        born: now,
        life: 900,
      });
    }
  }

  /** A wall hit: the car flashes, harder the faster it hit, and dust flies off the wall. */
  bump(
    id: string,
    car: Box,
    impact: number,
    nx: number,
    ny: number,
    gate: boolean,
    p: Palette,
    now: number,
  ) {
    if (impact < 1.2) return;
    // A flash is a colour change, not motion: it stays with reduced motion.
    this.hits.set(id, { born: now, strength: Math.min(1, 0.35 + impact / 6) });
    if (gate || this.reduced) return; // checkpoints are lines on the road, nothing to kick up
    const contactX = car.x + car.width / 2 + (nx * car.width) / 2;
    const contactY = car.y + car.height / 2 + (ny * car.height) / 2;
    const count = Math.round(Math.min(10, impact * 1.6));
    for (let i = 0; i < count; i++) {
      // Spray back from the wall, spread sideways along it.
      const along = (Math.random() - 0.5) * 0.16;
      const back = 0.03 + Math.random() * 0.06;
      this.particles.push({
        x: contactX,
        y: contactY,
        vx: -nx * back + (nx === 0 ? along : 0),
        vy: -ny * back + (ny === 0 ? along : 0),
        size: 1.5 + Math.random() * 2,
        color: p.muted,
        shape: "square",
        born: now,
        life: 350 + Math.random() * 250,
        alpha: 0.7,
      });
    }
  }

  /** Called every frame for a car on nitro: circles that shrink behind it. */
  trail(id: string, car: Box & { rotation: number }, p: Palette, now: number) {
    if (this.reduced || now - (this.lastTrail.get(id) ?? 0) < TRAIL_EVERY_MS) return;
    this.lastTrail.set(id, now);
    const facing = ((car.rotation + 180) * Math.PI) / 180;
    const rearX = car.x + car.width / 2 - Math.cos(facing) * 11;
    const rearY = car.y + car.height / 2 - Math.sin(facing) * 11;
    this.particles.push({
      x: rearX + (Math.random() - 0.5) * 4,
      y: rearY + (Math.random() - 0.5) * 4,
      vx: -Math.cos(facing) * 0.03,
      vy: -Math.sin(facing) * 0.03,
      size: 4 + Math.random() * 1.5,
      color: p.accent,
      shape: "circle",
      born: now,
      life: 380,
      alpha: 0.45,
    });
  }

  /** How strongly to wash a car in light right now (0–1): a quick flash that fades. */
  flash(id: string, now: number) {
    const hit = this.hits.get(id);
    if (!hit) return 0;
    const t = (now - hit.born) / HIT_MS;
    if (t >= 1) {
      this.hits.delete(id);
      return 0;
    }
    return hit.strength * (1 - t) ** 2;
  }

  /** Particles and rings: drawn under the cars. */
  drawBelow(ctx: CanvasRenderingContext2D, now: number) {
    ctx.save();
    this.particles = this.particles.filter((pt) => {
      const age = now - pt.born;
      const t = age / pt.life;
      if (t >= 1) return false;
      // Particles slow down as they go (ease-out), and fade.
      const travel = age * (1 - t / 2);
      const x = pt.x + pt.vx * travel;
      const y = pt.y + pt.vy * travel;
      const size = pt.shape === "circle" ? pt.size * (1 - t) : pt.size;
      ctx.globalAlpha = pt.alpha * (1 - t);
      ctx.fillStyle = pt.color;
      if (pt.shape === "circle") {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0, size), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
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

  /** Floating labels: drawn over everything. */
  drawAbove(ctx: CanvasRenderingContext2D, p: Palette, now: number, locate: Locate) {
    ctx.save();
    ctx.font = `600 11px ${p.font}`;
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    this.floaters = this.floaters.filter((f) => {
      const t = (now - f.born) / f.life;
      const car = locate(f.id);
      if (t >= 1 || !car) return false;
      const x = car.x + car.width / 2;
      const y = car.y - 20;
      const rise = this.reduced ? 0 : 16 * (1 - (1 - t) ** 2);
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.bg;
      ctx.strokeText(f.text, x, y - rise);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y - rise);
      return true;
    });
    ctx.restore();
  }
}
