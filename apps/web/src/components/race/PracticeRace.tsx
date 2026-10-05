"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  NO_KEYS,
  TICK_RATE,
  botKeys,
  classicTrack as track,
  createRace,
  standings,
  stepRace,
  type Keys,
  type RaceState,
} from "race-engine";
import { readPalette, type CarLook, type Palette } from "./draw";
import { Controls } from "./Controls";
import {
  CompactHud,
  DifficultyPicker,
  FinishingVeil,
  LapPanel,
  PauseButton,
  ResultsCard,
  RestartButton,
  StandingsBoard,
  StartCard,
  TouchPad,
  TrackOverlays,
  RACE_GRID,
  TRACK_COLUMN,
  VEIL,
  makeConfetti,
  type ConfettiPiece,
} from "./hud";
import {
  BOTS,
  LAPS,
  PLAYER,
  bestLap,
  loadBest,
  loadDifficulty,
  resultRows,
  saveBest,
  saveDifficulty,
  storage,
  updateBest,
  type Difficulty,
  type PersonalBest,
} from "./session";
import {
  KEY_MAP,
  RaceView,
  buildTrackLayer,
  emptyHud,
  litLights,
  sizeCanvas,
  type Hud,
} from "./view";

const BOT_IDS = BOTS.normal.map((b) => b.id);
const STEP_MS = 1000 / TICK_RATE;
const COUNTDOWN_MS = 3000;
/** After you cross the line, the bots get this long to finish before the results show anyway. */
const WAIT_TICKS = 45 * TICK_RATE;

/** "finishing": you're done, the bots are still racing. */
type Phase = "ready" | "countdown" | "racing" | "finishing" | "paused" | "finished";
type Outcome = { newRace: boolean; newLap: boolean };

const newRace = () => createRace(track, [PLAYER, ...BOT_IDS], LAPS);

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
  const view = useRef<RaceView | null>(null);
  const difficultyRef = useRef<Difficulty>("normal");
  const bestRef = useRef<PersonalBest>({ race: null, lap: null, splits: null });
  const celebratedRef = useRef(false);

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [hud, setHud] = useState<Hud>(() => emptyHud(newRace()));
  const [result, setResult] = useState<RaceState | null>(null);
  const [difficulty, setDifficultyState] = useState<Difficulty>("normal");
  const [best, setBest] = useState<PersonalBest>({ race: null, lap: null, splits: null });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confetti, setConfetti] = useState<ConfettiPiece[] | null>(null);

  useEffect(() => {
    bestRef.current = best;
  }, [best]);

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
    view.current?.reset();
    celebratedRef.current = false;
    setResult(null);
    setOutcome(null);
    setConfetti(null);
    countdownEnd.current = performance.now() + COUNTDOWN_MS;
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
      trackLayer.current = buildTrackLayer(palette.current);
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
    view.current ??= new RaceView(PLAYER, LAPS, reduced);
    const v = view.current;
    const running = () => phaseRef.current === "racing" || phaseRef.current === "finishing";
    const moving = () => running() || phaseRef.current === "paused";
    // You in the site's blue with a stripe; each bot in its own colour.
    const look =
      (p: Palette) =>
      (id: string): CarLook =>
        id === PLAYER
          ? { body: p.accent, helmet: p.c.bolt, stripe: true, highlight: true }
          : { body: p.c.bots[BOT_IDS.indexOf(id)]!, helmet: p.c.helmet, stripe: false };

    const finish = (s: RaceState) => {
      setResult(s);
      setPhase("finished");
      const me = s.cars.find((c) => c.id === PLAYER)!;
      if (me.finishedAt === null) return;
      const d = difficultyRef.current;
      const lap = bestLap(me);
      const lapIndex = lap !== null ? me.lapTicks.indexOf(lap) : -1;
      const splits = lapIndex >= 0 ? (v.lapHistory[lapIndex] ?? null) : null;
      const next = updateBest(loadBest(storage(), d), me.finishedAt, lap, splits);
      saveBest(storage(), d, next.best);
      setBest(next.best);
      setOutcome({ newRace: next.newRace, newLap: next.newLap });
    };

    const frame = (now: number) => {
      const dt = Math.min(now - last, 250);
      last = now;

      if (phaseRef.current === "countdown" && now >= countdownEnd.current) {
        setPhase("racing");
        v.lightsOut(now);
        setAnnouncement(t("go"));
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
          const p = palette.current;
          if (p && v.react(next, p, now, bestRef.current.splits)) {
            setAnnouncement(t("announceLastLap"));
          }

          const me = next.cars.find((c) => c.id === PLAYER)!;
          if (phaseRef.current === "racing" && me.finishedAt !== null) {
            setPhase("finishing");
            if (!celebratedRef.current && next.finished[0] === PLAYER) {
              celebratedRef.current = true;
              if (p) setConfetti(makeConfetti([p.accent, p.c.bolt, ...p.c.bots]));
            }
          }
          const allDone = next.finished.length === next.cars.length;
          if (me.finishedAt !== null && (allDone || next.tick - me.finishedAt >= WAIT_TICKS)) {
            finish(next);
            acc = 0;
            break;
          }
        }
      }

      const canvas = canvasRef.current;
      const p = palette.current;
      if (canvas && p && trackLayer.current) {
        const ctx = sizeCanvas(canvas);
        v.draw(ctx, trackLayer.current, race.current, prev.current, acc / STEP_MS, p, now, {
          moving: moving(),
          running: running(),
          look: look(p),
          name: names,
        });
      }
      if (now - hudAt > 100) {
        hudAt = now;
        const lit =
          phaseRef.current === "countdown"
            ? litLights(now - (countdownEnd.current - COUNTDOWN_MS))
            : 0;
        const { hud: next, announce } = v.hud(
          race.current,
          now,
          phaseRef.current === "racing",
          lit,
        );
        setHud(next);
        if (announce)
          setAnnouncement(t("announcePosition", { place: t("ordinal", { n: announce }) }));
      }
      raf = requestAnimationFrame(frame);
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

  /** The race is on screen (lights, racing, paused): phones swap the panels for one line. */
  const onTrack =
    phase === "countdown" || phase === "racing" || phase === "finishing" || phase === "paused";

  const results = (focus: boolean) =>
    result && (
      <ResultsCard
        rows={resultRows(standings(result, track))}
        me={PLAYER}
        place={result.finished.indexOf(PLAYER) + 1}
        myTime={result.cars.find((c) => c.id === PLAYER)?.finishedAt ?? null}
        outcome={outcome}
        name={names}
        t={t}
      >
        <DifficultyPicker value={difficulty} onChange={chooseDifficulty} t={t} />
        <RestartButton
          buttonRef={focus ? restartRef : undefined}
          onClick={start}
          label={t("restart")}
          hint={t("restartHint")}
        />
      </ResultsCard>
    );

  return (
    // Standings on the left, the track in the middle, lap and time on the right.
    // Below lg the track drops under the two panels.
    <div
      data-phase={phase}
      data-tick={hud.tick}
      data-player-x={hud.playerX}
      ref={rootRef}
      className={RACE_GRID}
    >
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <StandingsBoard
        board={hud.board}
        me={PLAYER}
        name={names}
        hideOnPhones={onTrack || phase === "ready"}
        t={t}
      />
      <LapPanel hud={hud} laps={LAPS} best={best} idle={phase === "ready"} racing={onTrack} t={t} />

      <div className={TRACK_COLUMN}>
        {onTrack && <CompactHud hud={hud} me={PLAYER} laps={LAPS} t={t} />}
        <div className="relative overflow-hidden rounded-[var(--radius-photo)] ring-1 ring-line">
          <canvas
            ref={canvasRef}
            tabIndex={-1}
            role="img"
            aria-label={t("canvasLabel")}
            className="block aspect-[760/600] w-full bg-bg outline-none"
          />

          <TrackOverlays
            hud={hud}
            countdown={phase === "countdown"}
            racing={phase === "racing" || phase === "finishing"}
            showLastLap={phase === "racing"}
            confetti={phase === "finishing" || phase === "finished" ? confetti : null}
            t={t}
          />

          {phase === "finishing" && hud.place > 0 && (
            <FinishingVeil place={hud.place} onSkip={skip} t={t} />
          )}

          {(phase === "racing" || phase === "finishing") && <PauseButton onClick={pause} t={t} />}

          {/* The countdown has no veil: the grid and the lights stay in full view. */}
          {(phase === "ready" || phase === "paused" || phase === "finished") && (
            <div className={VEIL}>
              {phase === "ready" && (
                <StartCard>
                  {/* Phones: the track is too short for the legend too; it goes under the controls. */}
                  <div className="w-full max-lg:hidden">
                    <Controls />
                  </div>
                  <DifficultyPicker value={difficulty} onChange={chooseDifficulty} t={t} />
                  <div className="flex flex-col items-center gap-2">
                    <button type="button" onClick={start} className="btn btn-primary">
                      {t("start")}
                    </button>
                    <p className="hidden text-xs text-muted lg:block">{t("startHint")}</p>
                  </div>
                </StartCard>
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

        <TouchPad press={press} hidden={phase === "finished"} t={t} />
        {phase === "ready" && (
          <div className="mt-6 lg:hidden">
            <Controls />
          </div>
        )}
      </div>
    </div>
  );
}
