"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  NO_KEYS,
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
import { drawCar, drawItem, drawTrack, interpolateCar, readPalette, type Palette } from "./draw";

const PLAYER = "you";
const BOTS = [
  { id: "bot2", skill: 1 },
  { id: "bot3", skill: 0.9 },
  { id: "bot4", skill: 0.8 },
];
const LAPS = 2;
const STEP_MS = 1000 / TICK_RATE;
const COUNTDOWN_MS = 3000;

type Phase = "ready" | "countdown" | "racing" | "finished";
type Hud = { tick: number; lap: number; position: number; nitro: number; playerX: number };

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
  const [hud, setHud] = useState<Hud>({ tick: 0, lap: 1, position: 1, nitro: 0, playerX: 0 });
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

  // Keyboard, only while a race is on (so arrows still scroll the page otherwise).
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

    const frame = (now: number) => {
      const dt = Math.min(now - last, 250);
      last = now;

      if (phaseRef.current === "countdown") {
        const left = Math.ceil((countdownEnd.current - now) / 1000);
        setCount(left);
        if (now >= countdownEnd.current) setPhase("racing");
      }

      if (phaseRef.current === "racing") {
        acc += dt;
        while (acc >= STEP_MS) {
          const s = race.current;
          const inputs: Record<string, Keys> = { [PLAYER]: keys.current };
          for (const bot of BOTS) {
            const car = s.cars.find((c) => c.id === bot.id)!;
            inputs[bot.id] = botKeys(car, track, { skill: bot.skill });
          }
          prev.current = s;
          race.current = stepRace(s, track, inputs);
          acc -= STEP_MS;
          if (race.current.finished.includes(PLAYER)) {
            setResult(race.current);
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
          lap: Math.min(LAPS, me.laps + 1),
          position: standings(s, track).findIndex((c) => c.id === PLAYER) + 1,
          nitro: me.nitro,
          playerX: Math.round(me.x),
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
      // Bots first, the player on top.
      const ordered = [
        ...s.cars.filter((c) => c.id !== PLAYER),
        ...s.cars.filter((c) => c.id === PLAYER),
      ];
      for (const car of ordered) {
        const before = prev.current?.cars.find((c) => c.id === car.id);
        const at = phaseRef.current === "racing" ? interpolateCar(before, car, alpha) : car;
        const body = car.id === PLAYER ? p.accent : bodies[BOTS.findIndex((b) => b.id === car.id)]!;
        drawCar(ctx, at, body, p, car.nitroUntil !== null);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [setPhase]);

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

  const press = (key: keyof Keys, down: boolean) => {
    keys.current = { ...keys.current, [key]: down };
  };

  const final = result ? standings(result, track) : [];

  return (
    // Never taller than the window: the whole track stays in view while you drive.
    <div
      data-phase={phase}
      data-tick={hud.tick}
      data-player-x={hud.playerX}
      ref={rootRef}
      className="w-full max-w-[calc((100svh-7rem)*760/600)] scroll-mt-20"
    >
      <dl className="mb-3 flex flex-wrap gap-x-8 gap-y-2 text-sm tabular-nums" aria-live="polite">
        <div className="flex gap-2">
          <dt className="text-muted">{t("lap")}</dt>
          <dd>
            {hud.lap}/{LAPS}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">{t("position")}</dt>
          <dd>
            {t("ordinal", { n: hud.position })} / {BOTS.length + 1}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">{t("nitro")}</dt>
          <dd aria-label={String(hud.nitro)} className="tracking-widest text-accent">
            {"◆".repeat(hud.nitro)}
            <span className="text-line">{"◆".repeat(3 - hud.nitro)}</span>
          </dd>
        </div>
        <div className="flex gap-2" aria-live="off">
          <dt className="text-muted">{t("time")}</dt>
          <dd>{formatTime(hud.tick)}</dd>
        </div>
      </dl>

      <div className="relative overflow-hidden rounded-[var(--radius-photo)] ring-1 ring-line">
        <canvas
          ref={canvasRef}
          tabIndex={-1}
          role="img"
          aria-label={t("canvasLabel")}
          className="block aspect-[760/600] w-full bg-bg outline-none"
        />

        {phase !== "racing" && (
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
                  {t("finishedTime", { time: formatTime(result.tick) })}
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
