"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  wrongWay,
  type Keys,
  type RaceState,
} from "race-engine";
import {
  drawCar,
  drawItem,
  type CarLook,
  drawLabel,
  drawTarget,
  drawTrack,
  interpolateCar,
  readPalette,
  type Palette,
} from "./draw";
import { Effects } from "./effects";
import { BoltIcon } from "./icons";
import {
  BOTS,
  DIFFICULTIES,
  GATE_WARNING_TICKS,
  LAPS,
  PLAYER,
  WRONG_WAY_TICKS,
  bestLap,
  formatGap,
  formatTime,
  loadBest,
  loadDifficulty,
  resultRows,
  saveBest,
  saveDifficulty,
  updateBest,
  type Difficulty,
  type PersonalBest,
} from "./session";

const BOT_IDS = BOTS.normal.map((b) => b.id);
const STEP_MS = 1000 / TICK_RATE;
const COUNTDOWN_MS = 3000;
/** After you cross the line, the bots get this long to finish before the results show anyway. */
const WAIT_TICKS = 45 * TICK_RATE;
const LAST_LAP_MS = 2200;

/** "finishing": you're done, the bots are still racing. */
type Phase = "ready" | "countdown" | "racing" | "finishing" | "paused" | "finished";
type Driver = { id: string; nitro: number; done: boolean };
type Hud = {
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
};
type Outcome = { newRace: boolean; newLap: boolean };

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

const newRace = () => createRace(track, [PLAYER, ...BOT_IDS], LAPS);

const board = (s: RaceState): Driver[] =>
  standings(s, track).map((c) => ({ id: c.id, nitro: c.nitro, done: c.finishedAt !== null }));

const initialHud = (): Hud => ({
  tick: 0,
  time: 0,
  lap: 1,
  laps: [],
  place: 0,
  playerX: 0,
  board: board(newRace()),
  wrongWay: false,
  lastLap: false,
});

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
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
  const resumeTo = useRef<Phase>("racing");
  const countdownEnd = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const effects = useRef<Effects | null>(null);
  const difficultyRef = useRef<Difficulty>("normal");
  // Per-race feedback state, reset on every start.
  const wrongTicks = useRef(0);
  const gateAt = useRef<number | null>(null);
  const lastLapUntil = useRef(0);
  const position = useRef({ candidate: 0, since: 0, announced: 0 });

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState<Hud>(initialHud);
  const [result, setResult] = useState<RaceState | null>(null);
  const [difficulty, setDifficultyState] = useState<Difficulty>("normal");
  const [best, setBest] = useState<PersonalBest>({ race: null, lap: null });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const names = useCallback(
    (id: string) => (id === PLAYER ? t("you") : t("bot", { n: id.replace("bot", "") })),
    [t],
  );

  const chooseDifficulty = useCallback((d: Difficulty) => {
    difficultyRef.current = d;
    setDifficultyState(d);
    setBest(loadBest(storage(), d));
    saveDifficulty(storage(), d);
  }, []);

  // The last difficulty and the record live in this browser only, so they're
  // read after hydration (the server renders the defaults).
  useEffect(() => {
    const id = requestAnimationFrame(() => chooseDifficulty(loadDifficulty(storage())));
    return () => cancelAnimationFrame(id);
  }, [chooseDifficulty]);

  const start = useCallback(() => {
    race.current = newRace();
    prev.current = null;
    keys.current = { ...NO_KEYS };
    effects.current?.clear();
    wrongTicks.current = 0;
    gateAt.current = null;
    lastLapUntil.current = 0;
    position.current = { candidate: 0, since: 0, announced: 0 };
    setResult(null);
    setOutcome(null);
    countdownEnd.current = performance.now() + COUNTDOWN_MS;
    setCount(3);
    setPhase("countdown");
    canvasRef.current?.focus({ preventScroll: true });
    // Bring the whole track into view: you can't drive what you can't see.
    rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [setPhase]);

  const pause = useCallback(() => {
    const p = phaseRef.current;
    if (p !== "racing" && p !== "finishing") return;
    resumeTo.current = p;
    keys.current = { ...NO_KEYS };
    setPhase("paused");
  }, [setPhase]);

  const resume = useCallback(() => {
    if (phaseRef.current === "paused") setPhase(resumeTo.current);
  }, [setPhase]);

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

  // Keyboard: driving keys only while you drive (so arrows still scroll the
  // page otherwise); Enter starts, R restarts, Esc or P pauses.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const p = phaseRef.current;
      if (!e.repeat) {
        if (e.code === "KeyR") {
          e.preventDefault();
          start();
          return;
        }
        if (e.code === "Escape" || e.code === "KeyP") {
          if (p === "paused") resume();
          else pause();
          return;
        }
        // A focused button already answers Enter with a click.
        const onButton = e.target instanceof HTMLButtonElement;
        if (e.code === "Enter" && !onButton) {
          if (p === "ready" || p === "finished") start();
          if (p === "paused") resume();
          return;
        }
      }
      const key = KEY_MAP[e.code];
      if (!key || (p !== "racing" && p !== "countdown")) return;
      e.preventDefault();
      keys.current = { ...keys.current, [key]: true };
    };
    const onUp = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (key) keys.current = { ...keys.current, [key]: false };
    };
    // Leaving the tab or the window pauses the race.
    const away = () => {
      keys.current = { ...NO_KEYS };
      pause();
    };
    const onVisibility = () => document.visibilityState === "hidden" && away();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", away);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", away);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [start, pause, resume]);

  // The results take the keyboard focus, so Enter races again.
  useEffect(() => {
    if (phase === "finished") restartRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // The loop: fixed 30 ticks/s simulation, drawn every frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    effects.current ??= new Effects(reduced);
    const fx = effects.current;
    const running = () => phaseRef.current === "racing" || phaseRef.current === "finishing";
    const moving = () => running() || phaseRef.current === "paused";

    const finish = (s: RaceState) => {
      setResult(s);
      setPhase("finished");
      const me = s.cars.find((c) => c.id === PLAYER)!;
      if (me.finishedAt === null) return;
      const d = difficultyRef.current;
      const next = updateBest(loadBest(storage(), d), me.finishedAt, bestLap(me));
      saveBest(storage(), d, next.best);
      setBest(next.best);
      setOutcome({ newRace: next.newRace, newLap: next.newLap });
    };

    const react = (s: RaceState, now: number) => {
      const p = palette.current;
      if (!p) return;
      for (const ev of s.events) {
        if (ev.type === "bump") {
          const car = s.cars.find((c) => c.id === ev.car)!;
          fx.bump(ev.car, car, ev.impact, ev.nx, ev.ny, ev.gate, p, now);
          if (ev.car === PLAYER && ev.gate) gateAt.current = s.tick;
        } else if (ev.type === "pickup") {
          const item = track.items.find((it) => it.id === ev.item)!;
          fx.pickup(item, ev.car, ev.car === PLAYER, p, now);
        } else if (ev.car === PLAYER && !ev.finished && ev.lap === LAPS - 1) {
          lastLapUntil.current = now + LAST_LAP_MS;
          setAnnouncement(t("announceLastLap"));
        }
      }
      const me = s.cars.find((c) => c.id === PLAYER)!;
      wrongTicks.current =
        me.finishedAt === null && wrongWay(me, track) ? wrongTicks.current + 1 : 0;
    };

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
          for (const bot of BOTS[difficultyRef.current]) {
            const car = s.cars.find((c) => c.id === bot.id)!;
            inputs[bot.id] = botKeys(car, track, bot.style);
          }
          prev.current = s;
          const next = stepRace(s, track, inputs);
          race.current = next;
          acc -= STEP_MS;
          react(next, now);

          const me = next.cars.find((c) => c.id === PLAYER)!;
          if (phaseRef.current === "racing" && me.finishedAt !== null) setPhase("finishing");
          const allDone = next.finished.length === next.cars.length;
          if (me.finishedAt !== null && (allDone || next.tick - me.finishedAt >= WAIT_TICKS)) {
            finish(next);
            acc = 0;
            break;
          }
        }
      }

      draw(acc / STEP_MS, now);
      if (now - hudAt > 100) {
        hudAt = now;
        const s = race.current;
        const me = s.cars.find((c) => c.id === PLAYER)!;
        const ranked = board(s);
        const place = ranked.findIndex((d) => d.id === PLAYER) + 1;
        setHud({
          tick: s.tick,
          time: me.finishedAt ?? s.tick,
          lap: Math.min(LAPS, me.laps + 1),
          laps: me.lapTicks,
          place: s.finished.indexOf(PLAYER) + 1,
          playerX: Math.round(me.x),
          board: ranked,
          wrongWay:
            me.finishedAt === null &&
            (wrongTicks.current >= WRONG_WAY_TICKS ||
              (gateAt.current !== null && s.tick - gateAt.current < GATE_WARNING_TICKS)),
          lastLap: now < lastLapUntil.current,
        });
        // Say the position once it has held for a moment, not at every overtake.
        const pos = position.current;
        if (place !== pos.candidate) {
          pos.candidate = place;
          pos.since = now;
        } else if (
          phaseRef.current === "racing" &&
          place !== pos.announced &&
          now - pos.since > 1500
        ) {
          pos.announced = place;
          setAnnouncement(t("announcePosition", { place: t("ordinal", { n: place }) }));
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const draw = (alpha: number, now: number) => {
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
      // Nitro badges float gently, each at its own beat.
      activeItems(track, s).forEach((item, i) =>
        drawItem(ctx, item, p, reduced ? 0 : Math.sin(now / 450 + i * 1.7)),
      );

      // Where you need to go next.
      const me = s.cars.find((c) => c.id === PLAYER)!;
      if (me.finishedAt === null) {
        const done = me.checkpoint === track.checkpoints.length;
        const box = done
          ? track.finishLine
          : track.checkpoints.find((cp) => cp.order === me.checkpoint + 1)!;
        drawTarget(ctx, box, done, p, reduced ? 0.6 : (Math.sin(now / 350) + 1) / 2);
      }

      // Bots first, the player on top; effects under the cars, names over them.
      const ordered = [
        ...s.cars.filter((c) => c.id !== PLAYER),
        ...s.cars.filter((c) => c.id === PLAYER),
      ].map((car) => {
        const before = prev.current?.cars.find((c) => c.id === car.id);
        return { car, at: moving() ? interpolateCar(before, car, alpha) : car };
      });
      for (const { car, at } of ordered) {
        if (car.nitroUntil !== null && running()) fx.trail(car.id, at, p, now);
      }
      fx.drawBelow(ctx, now);
      // Only the site's tokens: you in the accent, bots in ink and grey, told apart by a stripe.
      const looks: CarLook[] = [
        { body: p.ink, stripe: false },
        { body: p.muted, stripe: false },
        { body: p.ink, stripe: true },
      ];
      for (const { car, at } of ordered) {
        const look =
          car.id === PLAYER ? { body: p.accent, stripe: true } : looks[BOT_IDS.indexOf(car.id)]!;
        drawCar(ctx, at, look, p, car.nitroUntil !== null, fx.flash(car.id, now));
      }
      for (const { car, at } of ordered) {
        const boost =
          car.nitroUntil === null
            ? null
            : Math.max(0, Math.min(1, (car.nitroUntil - s.tick - alpha) / PHYSICS.nitroTicks));
        drawLabel(ctx, at, names(car.id), car.nitro, p, track.width, boost);
      }
      const where = new Map(ordered.map(({ car, at }) => [car.id, at]));
      fx.drawAbove(ctx, p, now, (id) => where.get(id));
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [setPhase, names, t]);

  const skip = () => {
    setResult(race.current);
    setPhase("finished");
  };

  const press = (key: keyof Keys, down: boolean) => {
    keys.current = { ...keys.current, [key]: down };
  };

  const rows = result ? resultRows(standings(result, track)) : [];
  const myTime = result?.cars.find((c) => c.id === PLAYER)?.finishedAt ?? null;
  const fastestLap = hud.laps.length > 0 ? Math.min(...hud.laps) : null;

  const results = (focus: boolean) =>
    result && (
      <div className="my-auto w-full max-w-sm rounded-2xl bg-bg p-4 text-center ring-1 ring-line sm:p-6">
        <p className="font-display text-2xl tracking-tight sm:text-3xl">
          {t("finished", { n: result.finished.indexOf(PLAYER) + 1 })}
        </p>
        {myTime !== null && (
          <p className="mt-1 text-sm text-muted tabular-nums">
            {t("finishedTime", { time: formatTime(myTime) })}
          </p>
        )}
        {(outcome?.newRace || outcome?.newLap) && (
          <p className="mt-2 text-sm text-accent">
            {outcome.newRace ? t("newRecord") : t("newBestLap")}
          </p>
        )}
        <table className="mt-4 w-full text-left text-xs tabular-nums sm:text-sm">
          <caption className="sr-only">{t("standings")}</caption>
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="pb-1 font-normal">
                {t("driver")}
              </th>
              <th scope="col" className="pb-1 text-right font-normal">
                {t("time")}
              </th>
              <th scope="col" className="pb-1 text-right font-normal">
                {t("bestLap")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className={row.id === PLAYER ? "text-accent" : undefined}>
                <th scope="row" className="py-0.5 pr-3 font-normal whitespace-nowrap">
                  {i + 1}. {names(row.id)}
                </th>
                <td className="py-0.5 text-right">
                  {row.time === null ? (
                    <span className="text-muted">{t("notFinished")}</span>
                  ) : row.time.kind === "total" ? (
                    formatTime(row.time.ticks)
                  ) : (
                    formatGap(row.time.ticks)
                  )}
                </td>
                <td className="py-0.5 pl-3 text-right text-muted">
                  {row.bestLap !== null ? formatTime(row.bestLap) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-5 flex flex-col items-center gap-4">
          <DifficultyPicker value={difficulty} onChange={chooseDifficulty} t={t} />
          <button
            ref={focus ? restartRef : undefined}
            type="button"
            onClick={start}
            className="btn btn-primary"
          >
            {t("restart")}
          </button>
          <p className="hidden text-xs text-muted lg:block">{t("restartHint")}</p>
        </div>
      </div>
    );
  return (
    // Standings on the left, the track in the middle, lap and time on the right.
    // Below lg the track drops under the two panels.
    <div
      data-phase={phase}
      data-tick={hud.tick}
      data-player-x={hud.playerX}
      ref={rootRef}
      className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-4 lg:grid-cols-[11rem_minmax(0,1fr)_7rem] lg:gap-x-8"
    >
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

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

      <dl className="col-start-2 row-start-1 flex flex-col gap-4 self-start tabular-nums lg:col-start-3">
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
        {hud.laps.length > 0 && (
          <div>
            <dt className="text-xs text-muted">{t("lapTimes")}</dt>
            <dd>
              <ol className="mt-1 space-y-0.5 text-sm">
                {hud.laps.map((ticks, i) => (
                  <li key={i} className={ticks === fastestLap ? "text-ink" : "text-muted"}>
                    <span className="mr-2 text-xs text-muted">{t("lapN", { n: i + 1 })}</span>
                    {formatTime(ticks)}
                  </li>
                ))}
              </ol>
            </dd>
          </div>
        )}
        <div className="border-t border-line pt-3 text-sm">
          <dt className="text-xs text-muted">{t("record")}</dt>
          <dd>{best.race !== null ? formatTime(best.race) : "—"}</dd>
          <dt className="mt-2 text-xs text-muted">{t("bestLap")}</dt>
          <dd>{best.lap !== null ? formatTime(best.lap) : "—"}</dd>
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

          {/* Banners over the race, never blocking it. */}
          <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-3">
            {hud.wrongWay && (phase === "racing" || phase === "finishing") && (
              <p
                role="status"
                className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-bg"
              >
                {t("wrongWay")}
              </p>
            )}
            {hud.lastLap && phase === "racing" && (
              <p className="font-display text-3xl tracking-tight text-accent drop-shadow-[0_1px_0_var(--bg)]">
                {t("lastLap")}
              </p>
            )}
          </div>

          {/* You're done: a soft veil, the race still visible behind it. */}
          {phase === "finishing" && hud.place > 0 && (
            <div
              role="status"
              className="race-fade-in pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/60 p-4 text-center"
            >
              <p className="font-display text-4xl tracking-tight sm:text-6xl">
                {t("finished", { n: hud.place })}
              </p>
              <p className="text-sm text-muted motion-safe:animate-pulse sm:text-base">
                {t("waiting")}
              </p>
              <button
                type="button"
                onClick={skip}
                className="pointer-events-auto mt-2 text-xs text-muted underline underline-offset-4 hover:text-ink"
              >
                {t("skip")}
              </button>
            </div>
          )}

          {/* Pause, any time: top left, out of the way of the banners. */}
          {(phase === "racing" || phase === "finishing") && (
            <button
              type="button"
              aria-label={t("pause")}
              onClick={pause}
              className="absolute top-2.5 left-2.5 grid size-8 place-items-center rounded-full bg-bg/85 text-muted ring-1 ring-line transition-colors hover:text-ink"
            >
              <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                <rect x="2.5" y="2" width="2.5" height="8" rx="1" fill="currentColor" />
                <rect x="7" y="2" width="2.5" height="8" rx="1" fill="currentColor" />
              </svg>
            </button>
          )}

          {(phase === "ready" ||
            phase === "countdown" ||
            phase === "paused" ||
            phase === "finished") && (
            <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-bg/70 p-3 backdrop-blur-[2px]">
              {phase === "ready" && (
                <div className="flex flex-col items-center gap-5">
                  <DifficultyPicker value={difficulty} onChange={chooseDifficulty} t={t} />
                  <button type="button" onClick={start} className="btn btn-primary">
                    {t("start")}
                  </button>
                  <p className="hidden text-xs text-muted lg:block">{t("startHint")}</p>
                </div>
              )}
              {phase === "countdown" && (
                <p className="font-display text-7xl tabular-nums" aria-live="assertive">
                  {count > 0 ? count : t("go")}
                </p>
              )}
              {phase === "paused" && (
                <div className="flex flex-col items-center gap-4 text-center">
                  <p className="font-display text-4xl tracking-tight">{t("paused")}</p>
                  <div className="flex gap-3">
                    <button type="button" onClick={resume} className="btn btn-primary">
                      {t("resume")}
                    </button>
                    <button type="button" onClick={start} className="btn btn-ghost">
                      {t("restart")}
                    </button>
                  </div>
                  <p className="hidden text-xs text-muted lg:block">{t("pausedHint")}</p>
                </div>
              )}
              {phase === "finished" && (
                <div className="hidden w-full justify-center lg:flex">{results(true)}</div>
              )}
            </div>
          )}
        </div>

        {/* Below lg the results don't fit over the track: they take the touch controls' place. */}
        {phase === "finished" && (
          <div className="mt-4 flex justify-center lg:hidden">{results(false)}</div>
        )}

        {/* Touch controls below lg (phones and tablets; pointer media queries aren't reliable). */}
        <div
          className={`mt-4 flex select-none items-center justify-between gap-3 lg:hidden ${phase === "finished" ? "hidden" : ""}`}
        >
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
              <BoltIcon className="mx-auto size-5 text-accent" />
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

function DifficultyPicker({
  value,
  onChange,
  t,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  t: ReturnType<typeof useTranslations<"Play">>;
}) {
  return (
    <div role="group" aria-label={t("difficulty")} className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted">{t("difficulty")}</span>
      <div className="flex rounded-full bg-bg p-1 ring-1 ring-line">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={value === d}
            onClick={() => onChange(d)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              value === d ? "bg-ink text-bg" : "text-muted hover:text-ink"
            }`}
          >
            {t(d)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Nitro charges as filled bolts out of the tank's size. */
function Nitro({ count, label }: { count: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5">
      {Array.from({ length: PHYSICS.maxNitro }, (_, i) => (
        <BoltIcon key={i} className={`size-3 ${i < count ? "text-accent" : "text-line"}`} />
      ))}
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
  children: ReactNode;
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
