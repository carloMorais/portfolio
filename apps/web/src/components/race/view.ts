import {
  PHYSICS,
  activeItems,
  classicTrack as track,
  standings,
  wrongWay,
  type Keys,
  type RaceState,
} from "race-engine";
import {
  drawCar,
  drawItem,
  drawLabel,
  drawTarget,
  drawTrack,
  interpolateCar,
  type CarLook,
  type Palette,
} from "./draw";
import { Effects } from "./effects";
import { Crowd, STANDS, drawScenery, seatFans } from "./scenery";
import { GATE_WARNING_TICKS, WRONG_WAY_TICKS } from "./session";

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
});

/** Lights lit `elapsed` ms into the countdown: one more every 500 ms, up to 5. */
export const litLights = (elapsed: number) =>
  Math.max(0, Math.min(5, Math.floor(elapsed / 500) + 1));

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
};

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
    let lastLap = false;
    for (const ev of s.events) {
      if (ev.type === "bump") {
        const car = s.cars.find((c) => c.id === ev.car);
        if (!car) continue;
        this.fx.bump(car, ev.impact, ev.nx, ev.ny, ev.gate, p, now);
        if (ev.car === this.me && ev.gate) this.gateAt = s.tick;
      } else if (ev.type === "pickup") {
        const item = track.items.find((it) => it.id === ev.item);
        if (!item) continue;
        this.fx.pickup(item, p, now);
        const car = s.cars.find((c) => c.id === ev.car);
        if (item.type !== 1 && car) {
          // The impact star goes exactly where the car met the obstacle.
          const x =
            (Math.max(car.x, item.x) + Math.min(car.x + car.width, item.x + item.width)) / 2;
          const y =
            (Math.max(car.y, item.y) + Math.min(car.y + car.height, item.y + item.height)) / 2;
          this.fx.impact(x, y, now);
        }
      } else if (ev.type === "respawn") {
        const item = track.items.find((it) => it.id === ev.item);
        if (item) this.fx.respawn(item, p, now);
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
    ctx.drawImage(layer, 0, 0);
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
      ),
    );

    // Where you need to go next.
    const me = s.cars.find((c) => c.id === this.me);
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
    for (const { car, at } of ordered) drawCar(ctx, at, o.look(car.id), p, car.nitroUntil !== null);
    fx.drawImpacts(ctx, p, now);
    for (const { car, at } of ordered) {
      // On the grid the cars sit nose to tail and every name would overlap:
      // only yours shows until the race is under way.
      if (s.tick === 0 && car.id !== this.me) continue;
      const boost =
        car.nitroUntil === null
          ? null
          : Math.max(0, Math.min(1, (car.nitroUntil - s.tick - alpha) / PHYSICS.nitroTicks));
      drawLabel(ctx, at, o.name(car.id), car.nitro, p, track.width, boost, car.id === this.me);
    }
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
      },
    };
  }
}
