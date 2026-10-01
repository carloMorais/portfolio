"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  NO_KEYS,
  PHYSICS,
  TICK_RATE,
  activeItems,
  botKeys,
  classicTrack as track,
  createRace,
  standings,
  stepRace,
  type Keys,
  type RaceState,
} from "race-engine";
import {
  drawCar,
  drawItem,
  drawLabel,
  drawTrack,
  interpolateCar,
  readPalette,
  type Palette,
} from "./draw";

const PLAYER = "you";
const BOTS = [
  { id: "bot2", skill: 1 },
  { id: "bot3", skill: 0.9 },
  { id: "bot4", skill: 0.8 },
];
const LAPS = 2;
const STEP_MS = 1000 / TICK_RATE;
const COUNTDOWN_MS = 3000;
/** After you cross the line, the bots get this long to finish before the results show anyway. */
const WAIT_TICKS = 45 * TICK_RATE;

/** "finishing": you're done, the bots are still racing. */
type Phase = "ready" | "countdown" | "racing" | "finishing" | "finished";
type Driver = { id: string; nitro: number; done: boolean };
type Hud = {
  tick: number;
  time: number;
  lap: number;
  /** Your finishing place, 0 while you race. */
  place: number;
  playerX: number;
  board: Driver[];
};

const KEY_MAP: Record<string, keyof Keys> = {
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

const formatTime = (ticks: number) => {
  const s = ticks / TICK_RATE;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

const newRace = () => createRace(track, [PLAYER, ...BOTS.map((b) => b.id)], LAPS);

const board = (s: RaceState): Driver[] =>
  standings(s, track).map((c) => ({ id: c.id, nitro: c.nitro, done: c.finishedAt !== null }));

const initialHud = (): Hud => {
  const s = newRace();
  return { tick: 0, time: 0, lap: 1, place: 0, playerX: 0, board: board(s) };
};

/**
 * Practice mode: the whole race runs in the browser at 30 ticks/s on the
 * shared engine, and is drawn at the screen's refresh rate by interpolating
 * between the last two ticks.
 */
export function PracticeRace() {
  const t = useTranslations("Play");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackLayer = useRef<HTMLCanvasElement | null>(null);
  const palette = useRef<Palette | null>(null);
  const race = useRef<RaceState>(newRace());
  const prev = useRef<RaceState | null>(null);
  const keys = useRef<Keys>({ ...NO_KEYS });
  const phaseRef = useRef<Phase>("ready");
  const countdownEnd = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState<Hud>(initialHud);
  const [result, setResult] = useState<RaceState | null>(null);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const names = useCallback(
    (id: string) => (id === PLAYER ? t("you") : t("bot", { n: id.replace("bot", "") })),
    [t],
  );

  // Track and colours: drawn once per theme into an offscreen layer.
  useEffect(() => {
    const build = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      palette.current = readPalette(canvas);
      const layer = document.createElement("canvas");
      layer.width = track.width;
      layer.height = track.height;
      drawTrack(layer.getContext("2d")!, track, palette.current);
      trackLayer.current = layer;
    };
    build();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", build);
    return () => media.removeEventListener("change", build);
  }, []);

  // Keyboard, only while you drive (so arrows still scroll the page otherwise).
  useEffect(() => {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (!key || (phaseRef.current !== "racing" && phaseRef.current !== "countdown")) return;
      e.preventDefault();
      keys.current = { ...keys.current, [key]: down };
    };
    const onDown = onKey(true);
    const onUp = onKey(false);
    const reset = () => (keys.current = { ...NO_KEYS });
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", reset);
    };
  }, []);

  // The loop: fixed 30 ticks/s simulation, drawn every frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    const running = () => phaseRef.current === "racing" || phaseRef.current === "finishing";

    const frame = (now: number) => {
      const dt = Math.min(now - last, 250);
      last = now;

      if (phaseRef.current === "countdown") {
        const left = Math.ceil((countdownEnd.current - now) / 1000);
        setCount(left);
        if (now >= countdownEnd.current) setPhase("racing");
      }

      if (running()) {
        acc += dt;
        while (acc >= STEP_MS) {
          const s = race.current;
          const inputs: Record<string, Keys> = { [PLAYER]: keys.current };
          for (const bot of BOTS) {
            const car = s.cars.find((c) => c.id === bot.id)!;
            inputs[bot.id] = botKeys(car, track, { skill: bot.skill });
          }
          prev.current = s;
          const next = stepRace(s, track, inputs);
          race.current = next;
          acc -= STEP_MS;

          const me = next.cars.find((c) => c.id === PLAYER)!;
          if (phaseRef.current === "racing" && me.finishedAt !== null) setPhase("finishing");
          const allDone = next.finished.length === next.cars.length;
          if (me.finishedAt !== null && (allDone || next.tick - me.finishedAt >= WAIT_TICKS)) {
            setResult(next);
            setPhase("finished");
            acc = 0;
            break;
          }
        }
      }

      draw(acc / STEP_MS);
      if (now - hudAt > 100) {
        hudAt = now;
        const s = race.current;
        const me = s.cars.find((c) => c.id === PLAYER)!;
        setHud({
          tick: s.tick,
          time: me.finishedAt ?? s.tick,
          lap: Math.min(LAPS, me.laps + 1),
          place: s.finished.indexOf(PLAYER) + 1,
          playerX: Math.round(me.x),
          board: board(s),
        });
      }
      raf = requestAnimationFrame(frame);
    };

    const draw = (alpha: number) => {
      const canvas = canvasRef.current;
      const p = palette.current;
      if (!canvas || !p || !trackLayer.current) return;
      const dpr = window.devicePixelRatio || 1;
      const w = track.width * dpr;
      if (canvas.width !== w) {
        canvas.width = w;
        canvas.height = track.height * dpr;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(trackLayer.current, 0, 0);

      const s = race.current;
      for (const item of activeItems(track, s)) drawItem(ctx, item, p);
      const bodies = [p.ink, p.muted, p.ink];
      // Bots first, the player on top; names over every car.
      const ordered = [
        ...s.cars.filter((c) => c.id !== PLAYER),
        ...s.cars.filter((c) => c.id === PLAYER),
      ].map((car) => {
        const before = prev.current?.cars.find((c) => c.id === car.id);
        return { car, at: running() ? interpolateCar(before, car, alpha) : car };
      });
      for (const { car, at } of ordered) {
        const body = car.id === PLAYER ? p.accent : bodies[BOTS.findIndex((b) => b.id === car.id)]!;
        drawCar(ctx, at, body, p, car.nitroUntil !== null);
      }
      for (const { car, at } of ordered) {
        drawLabel(ctx, at, names(car.id), car.nitro, p, track.width);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [setPhase, names]);

  const start = () => {
    race.current = newRace();
    prev.current = null;
    keys.current = { ...NO_KEYS };
    setResult(null);
    countdownEnd.current = performance.now() + COUNTDOWN_MS;
    setCount(3);
    setPhase("countdown");
    canvasRef.current?.focus({ preventScroll: true });
    // Bring the whole track into view: you can't drive what you can't see.
    rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const skip = () => {
    setResult(race.current);
    setPhase("finished");
  };

  const press = (key: keyof Keys, down: boolean) => {
    keys.current = { ...keys.current, [key]: down };
  };

  const final = result ? standings(result, track) : [];

  return (
    // Standings on the left, the track in the middle, lap and time on the right.
    // Below lg the track drops under the two panels.
    <div
      data-phase={phase}
      data-tick={hud.tick}
      data-player-x={hud.playerX}
      ref={rootRef}
      className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-4 lg:grid-cols-[11rem_minmax(0,1fr)_6rem] lg:gap-x-8"
    >
      <table className="col-start-1 row-start-1 self-start text-sm tabular-nums">
        <caption className="sr-only">{t("standings")}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="pr-3 pb-2 font-normal">
              {t("place")}
            </th>
            <th scope="col" className="pr-3 pb-2 font-normal">
              {t("driver")}
            </th>
            <th scope="col" className="pb-2 font-normal">
              {t("nitro")}
            </th>
          </tr>
        </thead>
        <tbody>
          {hud.board.map((d, i) => (
            <tr key={d.id} className="border-b border-line last:border-0">
              <td className="py-2 pr-3 text-muted">{i + 1}</td>
              <th
                scope="row"
                className={`py-2 pr-3 text-left font-normal whitespace-nowrap ${d.id === PLAYER ? "text-accent" : ""}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {names(d.id)}
                  {d.done && <FlagIcon label={t("done")} />}
                </span>
              </th>
              <td className="py-2">
                <Nitro count={d.nitro} label={t("nitroCount", { n: d.nitro })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="col-start-2 row-start-1 flex flex-col gap-4 self-start text-right tabular-nums lg:col-start-3">
        <div>
          <dt className="text-xs text-muted">{t("lap")}</dt>
          <dd className="font-display text-3xl tracking-tight">
            {hud.lap}
            <span className="text-muted">/{LAPS}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("time")}</dt>
          <dd className="font-display text-3xl tracking-tight">{formatTime(hud.time)}</dd>
        </div>
      </dl>

      {/* Never taller than the window: the whole track stays in view while you drive. */}
      <div className="col-span-2 row-start-2 mx-auto w-full max-w-[calc((100svh-7rem)*760/600)] lg:col-span-1 lg:col-start-2 lg:row-start-1">
        <div className="relative overflow-hidden rounded-[var(--radius-photo)] ring-1 ring-line">
          <canvas
            ref={canvasRef}
            tabIndex={-1}
            role="img"
            aria-label={t("canvasLabel")}
            className="block aspect-[760/600] w-full bg-bg outline-none"
          />

          {phase === "finishing" && hud.place > 0 && (
            <div
              className="absolute inset-x-0 top-3 flex justify-center px-3"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full bg-bg/90 px-4 py-2 text-sm ring-1 ring-line">
                <span>{t("finished", { n: hud.place })}</span>
                <span className="text-muted">{t("waiting")}</span>
                <button
                  type="button"
                  onClick={skip}
                  className="text-muted underline underline-offset-4 hover:text-ink"
                >
                  {t("skip")}
                </button>
              </div>
            </div>
          )}

          {(phase === "ready" || phase === "countdown" || phase === "finished") && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/70 backdrop-blur-[2px]">
              {phase === "ready" && (
                <button type="button" onClick={start} className="btn btn-primary">
                  {t("start")}
                </button>
              )}
              {phase === "countdown" && (
                <p className="font-display text-7xl tabular-nums" aria-live="assertive">
                  {count > 0 ? count : t("go")}
                </p>
              )}
              {phase === "finished" && result && (
                <div className="max-w-xs rounded-2xl bg-bg p-6 text-center ring-1 ring-line">
                  <p className="font-display text-3xl tracking-tight">
                    {t("finished", { n: result.finished.indexOf(PLAYER) + 1 })}
                  </p>
                  <p className="mt-1 text-sm text-muted tabular-nums">
                    {t("finishedTime", {
                      time: formatTime(
                        final.find((c) => c.id === PLAYER)?.finishedAt ?? result.tick,
                      ),
                    })}
                  </p>
                  <ol className="mt-5 space-y-1 text-left text-sm">
                    {final.map((car, i) => (
                      <li key={car.id} className="flex justify-between gap-6">
                        <span className={car.id === PLAYER ? "text-accent" : undefined}>
                          {i + 1}. {names(car.id)}
                        </span>
                        <span className="text-muted tabular-nums">
                          {car.finishedAt !== null ? formatTime(car.finishedAt) : t("notFinished")}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <button type="button" onClick={start} className="btn btn-primary mt-6">
                    {t("restart")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Touch controls below lg (phones and tablets; pointer media queries aren't reliable). */}
        <div className="mt-4 flex select-none justify-between gap-3 lg:hidden">
          <div className="flex gap-3">
            <TouchButton
              label={t("left")}
              onDown={() => press("left", true)}
              onUp={() => press("left", false)}
            >
              ←
            </TouchButton>
            <TouchButton
              label={t("right")}
              onDown={() => press("right", true)}
              onUp={() => press("right", false)}
            >
              →
            </TouchButton>
          </div>
          <div className="flex gap-3">
            <TouchButton
              label={t("nitroButton")}
              onDown={() => press("nitro", true)}
              onUp={() => press("nitro", false)}
            >
              ◆
            </TouchButton>
            <TouchButton
              label={t("brake")}
              onDown={() => press("down", true)}
              onUp={() => press("down", false)}
            >
              ↓
            </TouchButton>
            <TouchButton
              label={t("gas")}
              onDown={() => press("up", true)}
              onUp={() => press("up", false)}
            >
              ↑
            </TouchButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Nitro charges as filled diamonds out of the tank's size. */
function Nitro({ count, label }: { count: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="text-xs tracking-wider text-accent">
      {"◆".repeat(count)}
      <span className="text-line">{"◆".repeat(PHYSICS.maxNitro - count)}</span>
    </span>
  );
}

function FlagIcon({ label }: { label: string }) {
  return (
    <svg role="img" aria-label={label} viewBox="0 0 12 12" className="size-3 text-muted">
      <path d="M2 1v10" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.5 1.5h7l-1.5 2.5 1.5 2.5h-7z" fill="currentColor" />
    </svg>
  );
}

function TouchButton({
  label,
  onDown,
  onUp,
  children,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className="size-14 touch-none rounded-full text-xl ring-1 ring-line active:bg-surface"
    >
      {children}
    </button>
  );
}
