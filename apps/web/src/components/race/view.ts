import {
  PHYSICS,
  activeItems,
  overlaps,
  classicTrack as track,
  standings,
  wrongWay,
  type Car,
  type Keys,
  type RaceState,
} from "race-engine";
import {
  drawBoost,
  drawCar,
  drawItem,
  drawLabel,
  drawVignette,
  drawTarget,
  drawTrack,
  interpolateCar,
  type CarLook,
  type Palette,
} from "./draw";
import { Effects } from "./effects";
import { Crowd, STANDS, drawScenery, seatFans } from "./scenery";
import { GATE_WARNING_TICKS, WRONG_WAY_TICKS } from "./session";
import type { RaceSound } from "./sound";

const LAST_LAP_MS = 2200;
const START_FLASH_MS = 500;
const CHANGE_MS = 1600;
/** Say the position once it has held this long, not at every overtake. */
const POSITION_HOLD_MS = 1500;

export type Driver = {
  id: string;
  nitro: number;
  done: boolean;
  /** Gained or lost a place in the last ~1.6s, for a small arrow in the standings. */
  change: "up" | "down" | null;
};

export type Hud = {
  tick: number;
  time: number;
  lap: number;
  laps: number[];
  /** Your finishing place, 0 while you race. */
  place: number;
  playerX: number;
  board: Driver[];
  wrongWay: boolean;
  lastLap: boolean;
  justStarted: boolean;
  /** Ticks ahead (negative) or behind your reference lap at the last checkpoint crossed. */
  delta: number | null;
  /** Starting lights lit, 0–5 (only meaningful during the countdown). */
  lit: number;
  /** You've sat still for a couple of seconds into the race: show how to drive. */
  idle: boolean;
};

export const boardOf = (s: RaceState): Driver[] =>
  standings(s, track).map((c) => ({
    id: c.id,
    nitro: c.nitro,
    done: c.finishedAt !== null,
    change: null,
  }));

export const emptyHud = (s: RaceState): Hud => ({
  tick: 0,
  time: 0,
  lap: 1,
  laps: [],
  place: 0,
  playerX: 0,
  board: boardOf(s),
  wrongWay: false,
  lastLap: false,
  justStarted: false,
  delta: null,
  lit: 0,
  idle: false,
});

/**
 * Lights lit `elapsed` ms into a countdown of `total` ms: five lights, one
 * more every sixth of it (500 ms in the full 3 s countdown), then lights out.
 */
export const litLights = (elapsed: number, total = 3000) =>
  Math.max(0, Math.min(5, Math.floor(elapsed / (total / 6)) + 1));

export const KEY_MAP: Record<string, keyof Keys> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "nitro",
};

/** The track and scenery, drawn once per theme into an offscreen layer. */
export function buildTrackLayer(p: Palette) {
  const layer = document.createElement("canvas");
  layer.width = track.width;
  layer.height = track.height;
  const ctx = layer.getContext("2d")!;
  drawTrack(ctx, track, p);
  drawScenery(ctx, p);
  drawVignette(ctx, track.width, track.height);
  return layer;
}

/** Matches the canvas to the track at the screen's pixel ratio; returns its context. */
export function sizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const w = track.width * dpr;
  if (canvas.width !== w) {
    canvas.width = w;
    canvas.height = track.height * dpr;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

type DrawOptions = {
  /** Interpolate between ticks (racing or paused, not on the grid). */
  moving: boolean;
  /** Leave nitro trails (the race is running). */
  running: boolean;
  look: (id: string) => CarLook;
  name: (id: string) => string;
  /** How much bigger than their boxes cars and items are drawn (phones: the map is tiny). */
  zoom?: number;
  /** Follow your car with a zoomed-in camera, with the whole map in a corner (phones, in a race). */
  follow?: boolean;
  /** Time trial: your best run, replayed (faint, under the cars). */
  ghost?: { car: Car; before: Car | null; look: CarLook } | null;
};

/** The phone camera: how close it gets, and how quickly it eases (ms). */
const CAMERA_ZOOM = 1.9;
const CAMERA_EASE_MS = 140;
/** Sitting still this long (ticks) into a race brings up the "hold up" hint. */
const IDLE_TICKS = 60;
const MINIMAP_WIDTH = 210;

/** A hard turn at speed, or heavy braking, marks the road. */
const SKID_TURN = 5.5;
const SKID_SPEED = 4.5;
const SKID_BRAKE = 0.3;

/** What zoom to draw cars and items at for a canvas `cssWidth` px wide. */
export const zoomFor = (cssWidth: number) => (cssWidth > 0 && cssWidth < 640 ? 1.3 : 1);

/**
 * Everything both race modes show on top of the engine's state, whichever
 * side computed it (the browser in practice, the server online): the crowd,
 * items, next checkpoint, cars, effects and labels, and the feedback the HUD
 * reads (wrong way, last lap, sector delta against your best lap, place
 * changes). Feed it every tick with `react`, draw with `draw`, read the HUD
 * with `hud`.
 */
export class RaceView {
  readonly fx: Effects;
  private readonly fans = seatFans(STANDS, 7);
  private readonly crowd = new Crowd(STANDS.length);
  private wrongTicks = 0;
  private gateAt: number | null = null;
  private lastLapUntil = 0;
  private startFlashUntil = 0;
  private position = { candidate: 0, since: 0, announced: 0 };
  /** Your checkpoint splits this lap, and every completed lap's. */
  private splits: number[] = [];
  readonly lapHistory: number[][] = [];
  /** Live delta against `reference` (sticky between checkpoints). */
  private delta: number | null = null;
  private prevOrder: string[] = [];
  private readonly changeUntil = new Map<string, { dir: "up" | "down"; until: number }>();
  /** Each car's rotation and speed at the last state seen, for tyre marks and exhaust. */
  private readonly motion = new Map<
    string,
    { tick: number; rotation: number; speed: number; boosting: boolean }
  >();
  /** Ticks you've sat still since the lights went out. */
  private stillTicks = 0;
  /** The camera's centre and zoom, eased towards their targets every frame. */
  private camera = { x: track.width / 2, y: track.height / 2, zoom: 1, at: 0 };
  /** Optional sound, set by the race component (off unless switched on). */
  sound: RaceSound | null = null;

  constructor(
    public me: string,
    private readonly laps: number,
    readonly reduced: boolean,
  ) {
    this.fx = new Effects(reduced);
  }

  reset() {
    this.fx.clear();
    this.wrongTicks = 0;
    this.gateAt = null;
    this.lastLapUntil = 0;
    this.startFlashUntil = 0;
    this.position = { candidate: 0, since: 0, announced: 0 };
    this.splits = [];
    this.lapHistory.length = 0;
    this.delta = null;
    this.prevOrder = [];
    this.changeUntil.clear();
    this.motion.clear();
    this.stillTicks = 0;
  }

  /** A short buzz on phones that have it (Android), never with reduced motion. */
  private buzz(ms: number) {
    if (!this.reduced && typeof navigator !== "undefined") navigator.vibrate?.(ms);
  }

  /** The lights just went out: the "Go!" flash. */
  lightsOut(now: number) {
    this.startFlashUntil = now + START_FLASH_MS;
  }

  /**
   * One tick's events: effects, the delta at each checkpoint against
   * `reference` (your best lap's splits), lap bookkeeping. Returns true when
   * you just started the last lap.
   */
  react(s: RaceState, p: Palette, now: number, reference: number[] | null): boolean {
    this.effects(s, p, now);
    return this.follow(s, now, reference);
  }

  /**
   * What a state looks and sounds like: dust, debris, tyre marks, nitro
   * bursts, items popping back, for the cars `only` picks (all of them by
   * default) and, with `items`, the items coming back. The online mode calls it
   * apart from `follow`, so each car's effects come from the state it is
   * drawn at: yours from the prediction, everyone else's from the delayed
   * states they are interpolated between.
   */
  effects(
    s: RaceState,
    p: Palette,
    now: number,
    only: (id: string) => boolean = () => true,
    items = true,
  ) {
    for (const ev of s.events) {
      if (ev.type === "respawn") {
        const item = items && track.items.find((it) => it.id === ev.item);
        if (item) this.fx.respawn(item, p, now);
        continue;
      }
      if (!only(ev.car)) continue;
      if (ev.type === "bump") {
        const car = s.cars.find((c) => c.id === ev.car);
        if (!car) continue;
        this.fx.bump(car, ev.impact, ev.nx, ev.ny, ev.gate, p, now);
        if (ev.car === this.me && !ev.gate && ev.impact >= 1.2) {
          this.sound?.thud(ev.impact / 6);
          this.buzz(ev.impact >= 3 ? 30 : 15);
        }
      } else if (ev.type === "pickup") {
        const item = track.items.find((it) => it.id === ev.item);
        if (!item) continue;
        this.fx.pickup(item, p, now);
        if (ev.car === this.me) {
          if (item.type === 1) this.sound?.chirp();
          else {
            this.sound?.thud(0.8);
            this.buzz(40);
          }
        }
        const car = s.cars.find((c) => c.id === ev.car);
        if (item.type !== 1 && car) {
          // The impact star goes exactly where the car met the obstacle.
          const x =
            (Math.max(car.x, item.x) + Math.min(car.x + car.width, item.x + item.width)) / 2;
          const y =
            (Math.max(car.y, item.y) + Math.min(car.y + car.height, item.y + item.height)) / 2;
          this.fx.impact(x, y, now);
        }
      }
    }
    // Tyre marks on hard turns and heavy braking; a puff pulling away. The
    // online server sends every other tick: changes are per tick either way.
    for (const car of s.cars) {
      if (!only(car.id)) continue;
      const speed = Math.hypot(car.vx, car.vy);
      const last = this.motion.get(car.id);
      const boosting = car.nitroUntil !== null;
      this.motion.set(car.id, { tick: s.tick, rotation: car.rotation, speed, boosting });
      if (!last || car.finishedAt !== null) continue;
      const ticks = s.tick - last.tick;
      if (ticks <= 0) continue;
      if (boosting && !last.boosting) {
        this.fx.nitroBurst(car, p, now);
        if (car.id === this.me) this.sound?.whoosh();
      }
      let turn = Math.abs(car.rotation - last.rotation) % 360;
      if (turn > 180) turn = 360 - turn;
      turn /= ticks;
      const braking = (last.speed - speed) / ticks;
      const skids =
        (speed > SKID_SPEED && turn >= SKID_TURN) || (speed > 2 && braking > SKID_BRAKE);
      this.fx.tyres(car.id, car, skids, now);
      if (speed < 2.2 && speed > last.speed + 0.05 * ticks) this.fx.exhaust(car.id, car, now);
    }
  }

  /**
   * Your race, from a state: the delta at each checkpoint against `reference`
   * (your best lap's splits), laps, wrong way, sitting still. No effects.
   * Returns true when you just started the last lap.
   */
  follow(s: RaceState, now: number, reference: number[] | null): boolean {
    let lastLap = false;
    for (const ev of s.events) {
      if (ev.type === "bump" && ev.car === this.me && ev.gate) {
        this.gateAt = s.tick;
      } else if (ev.type === "checkpoint" && ev.car === this.me) {
        this.splits[ev.order - 1] = ev.ticks;
        this.delta =
          reference && reference[ev.order - 1] !== undefined
            ? ev.ticks - reference[ev.order - 1]!
            : null;
      } else if (ev.type === "lap" && ev.car === this.me) {
        this.lapHistory.push([...this.splits]);
        this.splits = [];
        this.delta = null;
        if (!ev.finished && ev.lap === this.laps - 1) {
          this.lastLapUntil = now + LAST_LAP_MS;
          lastLap = true;
        }
      }
    }

    const me = s.cars.find((c) => c.id === this.me);
    const still = me && me.finishedAt === null && s.tick > 0 && Math.hypot(me.vx, me.vy) < 0.3;
    this.stillTicks = still ? this.stillTicks + 1 : 0;
    this.wrongTicks = me && me.finishedAt === null && wrongWay(me, track) ? this.wrongTicks + 1 : 0;
    return lastLap;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    layer: HTMLCanvasElement,
    s: RaceState,
    prev: RaceState | null,
    alpha: number,
    p: Palette,
    now: number,
    o: DrawOptions,
  ) {
    const { fx, reduced } = this;
    const me = s.cars.find((c) => c.id === this.me);
    const meAt =
      me && o.moving
        ? interpolateCar(
            prev?.cars.find((c) => c.id === me.id),
            me,
            alpha,
          )
        : me;
    const cam = this.moveCamera(o.follow === true && !!meAt, meAt, now);
    // Following, the camera already brings the cars close: no extra zoom on top.
    const zoom = cam.zoom > 1.05 ? 1 : (o.zoom ?? 1);
    if (me) this.sound?.engine(Math.hypot(me.vx, me.vy), o.running && me.finishedAt === null);

    ctx.save();
    ctx.translate(track.width / 2, track.height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(layer, 0, 0);
    fx.drawSkids(ctx, now);
    // The crowd cheers when a car goes past its stand.
    this.crowd.draw(ctx, this.fans, p.c.fans, STANDS, s.cars, now, reduced);
    // Nitro badges float gently, each at its own beat; a just-respawned item pops in.
    activeItems(track, s).forEach((item, i) =>
      drawItem(
        ctx,
        item,
        p,
        reduced ? 0 : Math.sin(now / 450 + i * 1.7),
        reduced ? null : fx.respawnProgress(item.id, now),
        zoom,
      ),
    );

    // Where you need to go next.
    if (me && me.finishedAt === null) {
      const done = me.checkpoint === track.checkpoints.length;
      const box = done
        ? track.finishLine
        : track.checkpoints.find((cp) => cp.order === me.checkpoint + 1)!;
      drawTarget(ctx, box, done, p, reduced ? 0.6 : (Math.sin(now / 350) + 1) / 2);
    }

    // Everyone else first, you on top; effects under the cars, names over them.
    const ordered = [
      ...s.cars.filter((c) => c.id !== this.me),
      ...s.cars.filter((c) => c.id === this.me),
    ].map((car) => {
      const before = prev?.cars.find((c) => c.id === car.id);
      return { car, at: o.moving ? interpolateCar(before, car, alpha) : car };
    });
    for (const { car, at } of ordered) {
      if (car.nitroUntil !== null && o.running) fx.trail(car.id, at, p, now);
    }
    fx.draw(ctx, now);
    // Time trial: your best run, faint, under everything else.
    if (o.ghost) {
      const g = o.ghost;
      const at = o.moving ? interpolateCar(g.before ?? undefined, g.car, alpha) : g.car;
      drawCar(ctx, at, { ...g.look, opacity: 0.35, highlight: false }, p, false, zoom);
    }
    // Cars drive through each other: anyone overlapping another car fades
    // while they do, so it reads as a rule of the game, not a glitch. Yours never fades.
    for (const { car, at } of ordered) {
      const overlapping =
        car.id !== this.me &&
        ordered.some((other) => other.car.id !== car.id && overlaps(at, other.at));
      const look = o.look(car.id);
      drawCar(
        ctx,
        at,
        overlapping ? { ...look, opacity: 0.45 } : look,
        p,
        car.nitroUntil !== null,
        zoom,
      );
    }
    fx.drawImpacts(ctx, p, now);
    for (const { car, at } of ordered) {
      const boost =
        car.nitroUntil === null
          ? null
          : Math.max(0, Math.min(1, (car.nitroUntil - s.tick - alpha) / PHYSICS.nitroTicks));
      if (car.id === this.me) {
        drawLabel(ctx, at, o.name(car.id), car.nitro, p, track.width, boost, true, zoom);
      } else {
        // Everyone else is told apart by colour (the standings name it): no label, just the nitro bar.
        if (boost !== null) drawBoost(ctx, at, boost, p, zoom);
      }
    }
    ctx.restore();

    if (cam.zoom > 1.05) this.drawMinimap(ctx, layer, ordered, o, cam);
  }

  /** Eases the camera towards your car (following) or the whole map. */
  private moveCamera(follow: boolean, me: Car | undefined, now: number) {
    const cam = this.camera;
    const dt = cam.at ? Math.min(now - cam.at, 100) : 16;
    cam.at = now;
    const target = follow ? CAMERA_ZOOM : 1;
    const k = this.reduced ? 1 : 1 - Math.exp(-dt / CAMERA_EASE_MS);
    cam.zoom += (target - cam.zoom) * k;
    // Keep the view inside the map at the current zoom.
    const halfW = track.width / 2 / cam.zoom;
    const halfH = track.height / 2 / cam.zoom;
    const tx = follow && me ? me.x + me.width / 2 : track.width / 2;
    const ty = follow && me ? me.y + me.height / 2 : track.height / 2;
    cam.x += (Math.max(halfW, Math.min(track.width - halfW, tx)) - cam.x) * k;
    cam.y += (Math.max(halfH, Math.min(track.height - halfH, ty)) - cam.y) * k;
    return cam;
  }

  /** The whole map in the top-right corner while the camera follows you: everyone as a dot. */
  private drawMinimap(
    ctx: CanvasRenderingContext2D,
    layer: HTMLCanvasElement,
    cars: { car: Car; at: Car }[],
    o: DrawOptions,
    cam: { x: number; y: number; zoom: number },
  ) {
    const w = MINIMAP_WIDTH;
    const scale = w / track.width;
    const h = track.height * scale;
    const x = track.width - w - 10;
    const y = 10;
    // Fades in with the zoom, so it doesn't pop.
    const fade = Math.min(1, (cam.zoom - 1.05) / 0.5);
    ctx.save();
    ctx.globalAlpha = 0.92 * fade;
    ctx.fillStyle = "rgba(20, 20, 18, 0.55)";
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 7);
    ctx.clip();
    ctx.drawImage(layer, x, y, w, h);
    // What the camera shows.
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.7 * fade;
    ctx.lineWidth = 1.5;
    const vw = track.width / cam.zoom;
    const vh = track.height / cam.zoom;
    ctx.strokeRect(
      x + (cam.x - vw / 2) * scale,
      y + (cam.y - vh / 2) * scale,
      vw * scale,
      vh * scale,
    );
    ctx.globalAlpha = fade;
    for (const { car, at } of cars) {
      const cx = x + (at.x + at.width / 2) * scale;
      const cy = y + (at.y + at.height / 2) * scale;
      const mine = car.id === this.me;
      ctx.fillStyle = o.look(car.id).body;
      ctx.beginPath();
      ctx.arc(cx, cy, mine ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (mine) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * The HUD for the latest tick. `announce` is a place to say out loud (it
   * has held a moment and changed), or 0. Call it at most every ~100 ms.
   */
  hud(s: RaceState, now: number, racing: boolean, lit: number): { hud: Hud; announce: number } {
    const me = s.cars.find((c) => c.id === this.me)!;
    const ranked = standings(s, track);
    const order = ranked.map((c) => c.id);
    const place = order.indexOf(this.me) + 1;

    // A small up/down arrow wherever a driver's place just changed.
    if (this.prevOrder.length === order.length) {
      order.forEach((id, i) => {
        const was = this.prevOrder.indexOf(id);
        if (was !== -1 && was !== i) {
          this.changeUntil.set(id, { dir: was > i ? "up" : "down", until: now + CHANGE_MS });
        }
      });
    }
    this.prevOrder = order;
    const board: Driver[] = ranked.map((c) => {
      const mark = this.changeUntil.get(c.id);
      return {
        id: c.id,
        nitro: c.nitro,
        done: c.finishedAt !== null,
        change: mark && now < mark.until ? mark.dir : null,
      };
    });

    let announce = 0;
    const pos = this.position;
    if (place !== pos.candidate) {
      pos.candidate = place;
      pos.since = now;
    } else if (racing && place !== pos.announced && now - pos.since > POSITION_HOLD_MS) {
      pos.announced = place;
      announce = place;
    }

    return {
      announce,
      hud: {
        tick: s.tick,
        time: me.finishedAt ?? s.tick,
        lap: Math.min(this.laps, me.laps + 1),
        laps: me.lapTicks,
        place: s.finished.indexOf(this.me) + 1,
        playerX: Math.round(me.x),
        board,
        wrongWay:
          me.finishedAt === null &&
          (this.wrongTicks >= WRONG_WAY_TICKS ||
            (this.gateAt !== null && s.tick - this.gateAt < GATE_WARNING_TICKS)),
        lastLap: now < this.lastLapUntil,
        justStarted: now < this.startFlashUntil,
        delta: this.delta,
        lit,
        idle: racing && me.finishedAt === null && this.stillTicks >= IDLE_TICKS,
      },
    };
  }
}
