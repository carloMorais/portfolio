"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  NO_KEYS,
  TICK_RATE,
  botKeys,
  classicTrack as track,
  elasticStyle,
  raceProgress,
  createRace,
  standings,
  stepRace,
  type Keys,
  type RaceState,
} from "race-engine";
import { carColor } from "./colors";
import { readPalette, type CarLook, type Palette } from "./draw";
import { Controls } from "./Controls";
import { Pads, mergeKeys } from "./gamepad";
import {
  GHOST_VERSION,
  decodeKeys,
  encodeKeys,
  loadGhost,
  medalFor,
  nextMedal,
  saveGhost,
  type Ghost,
} from "./ghost";
import {
  ColorPicker,
  CompactHud,
  DifficultyPicker,
  FinishingVeil,
  LapPanel,
  MedalIcon,
  MedalPanel,
  MedalTargets,
  PauseButton,
  ResultsCard,
  RestartButton,
  SoundButton,
  StandingsBoard,
  StartCard,
  TouchPad,
  TrackButtons,
  TrackOverlays,
  RACE_GRID,
  TRACK_COLUMN,
  VEIL,
  makeConfetti,
  type ConfettiPiece,
  type SlideFrom,
} from "./hud";
import {
  BOTS,
  LAPS,
  PLAYER,
  bestLap,
  loadBest,
  loadColor,
  loadDifficulty,
  loadPref,
  practiceColors,
  resultRows,
  saveBest,
  saveColor,
  saveDifficulty,
  savePref,
  storage,
  updateBest,
  type Difficulty,
  type PersonalBest,
  type RecordKey,
} from "./session";
import { RaceSound } from "./sound";
import {
  KEY_MAP,
  RaceView,
  buildTrackLayer,
  emptyHud,
  litLights,
  sizeCanvas,
  zoomFor,
  type Hud,
} from "./view";

const BOT_IDS = BOTS.normal.map((b) => b.id);
/** Time trial races alone (a constant, so the callbacks built on it stay stable). */
const NO_BOTS: string[] = [];
const GHOST_ID = "ghost";
const STEP_MS = 1000 / TICK_RATE;
/** The first start runs the full lights; "race again" a shorter set (you know the drill by then). */
const COUNTDOWN_MS = 3000;
const QUICK_COUNTDOWN_MS = 1500;
/** After you cross the line, the bots get this long to finish before the results show anyway. */
const WAIT_TICKS = 45 * TICK_RATE;
/** Touch controls show below lg; the same query decides auto gas and the follow camera. */
const TOUCH_LAYOUT = "(max-width: 1023.98px)";

/** "finishing": you're done, the bots are still racing. */
type Phase = "ready" | "countdown" | "racing" | "finishing" | "paused" | "finished";
type Outcome = { newRace: boolean; newLap: boolean };
export type SoloVariant = "practice" | "trial";

/**
 * Practice mode (you against three bots) and time trial (you alone, against
 * the clock, your ghost and three medal times): the whole race runs in the
 * browser at 30 ticks/s on the shared engine, and is drawn at the screen's
 * refresh rate by interpolating between the last two ticks.
 */
export function PracticeRace({
  variant = "practice",
  modeSwitch,
  slideFrom,
}: {
  variant?: SoloVariant;
  /** The mode switch, on top of the start and results cards. */
  modeSwitch: ReactNode;
  slideFrom: SlideFrom;
}) {
  const trial = variant === "trial";
  const bots = trial ? NO_BOTS : BOT_IDS;
  const t = useTranslations("Play");
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackLayer = useRef<HTMLCanvasElement | null>(null);
  const palette = useRef<Palette | null>(null);
  const newRace = useCallback(() => createRace(track, [PLAYER, ...bots], LAPS), [bots]);
  const race = useRef<RaceState>(newRace());
  const prev = useRef<RaceState | null>(null);
  const keys = useRef<Keys>({ ...NO_KEYS });
  const phaseRef = useRef<Phase>("ready");
  const resumeTo = useRef<Phase>("racing");
  const countdownEnd = useRef(0);
  const countdownMs = useRef(COUNTDOWN_MS);
  const rootRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const view = useRef<RaceView | null>(null);
  const difficultyRef = useRef<Difficulty>("normal");
  /** Everyone's colour: yours, and the bots' (the next free ones). */
  const colorsRef = useRef(practiceColors(0, BOT_IDS));
  const bestRef = useRef<PersonalBest>({ race: null, lap: null, splits: null });
  const celebratedRef = useRef(false);
  const autoGasRef = useRef(true);
  const sound = useRef<RaceSound | null>(null);
  /** Time trial: the stored best run, the keys of this one, and the ghost replaying alongside. */
  const ghostRef = useRef<Ghost | null>(null);
  const recording = useRef<string[]>([]);
  const ghostRace = useRef<RaceState | null>(null);
  const ghostPrev = useRef<RaceState | null>(null);

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [hud, setHud] = useState<Hud>(() => emptyHud(newRace()));
  const [result, setResult] = useState<RaceState | null>(null);
  const [difficulty, setDifficultyState] = useState<Difficulty>("normal");
  const [myColor, setMyColor] = useState(0);
  const colorOf = useCallback(
    (id: string) => carColor(practiceColors(myColor, BOT_IDS)[id] ?? 0),
    [myColor],
  );
  const [best, setBest] = useState<PersonalBest>({ race: null, lap: null, splits: null });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confetti, setConfetti] = useState<ConfettiPiece[] | null>(null);
  const [autoGas, setAutoGas] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [hasGhost, setHasGhost] = useState(false);

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

  const recordKey = useCallback((d: Difficulty): RecordKey => (trial ? "trial" : d), [trial]);

  const chooseDifficulty = useCallback(
    (d: Difficulty) => {
      difficultyRef.current = d;
      setDifficultyState(d);
      setBest(loadBest(storage(), recordKey(d)));
      saveDifficulty(storage(), d);
    },
    [recordKey],
  );

  const chooseColor = useCallback((c: number) => {
    colorsRef.current = practiceColors(c, BOT_IDS);
    setMyColor(c);
    saveColor(storage(), c);
  }, []);

  const chooseAutoGas = useCallback((on: boolean) => {
    autoGasRef.current = on;
    setAutoGas(on);
    savePref(storage(), "autogas", on);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      sound.current?.setEnabled(!on);
      savePref(storage(), "sound", !on);
      return !on;
    });
  }, []);

  // What lives in this browser only (difficulty, colour, records, the ghost,
  // preferences) is read after hydration: the server renders the defaults.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      chooseDifficulty(loadDifficulty(storage()));
      const saved = loadColor(storage());
      if (saved !== null) chooseColor(saved);
      chooseAutoGas(loadPref(storage(), "autogas"));
      const wantsSound = loadPref(storage(), "sound");
      setSoundOn(wantsSound);
      // Browsers only let sound start after a click or a key: it wakes on "start".
      sound.current?.setEnabled(wantsSound);
      if (trial) {
        ghostRef.current = loadGhost(storage());
        setHasGhost(ghostRef.current !== null);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [chooseDifficulty, chooseColor, chooseAutoGas, trial]);

  const start = useCallback(() => {
    race.current = newRace();
    prev.current = null;
    keys.current = { ...NO_KEYS };
    view.current?.reset();
    celebratedRef.current = false;
    recording.current = [];
    ghostRace.current = trial && ghostRef.current ? createRace(track, [GHOST_ID], LAPS) : null;
    ghostPrev.current = null;
    sound.current?.wake();
    setResult(null);
    setOutcome(null);
    setConfetti(null);
    countdownEnd.current = performance.now() + countdownMs.current;
    setPhase("countdown");
    canvasRef.current?.focus({ preventScroll: true });
    // Bring the whole track into view: you can't drive what you can't see.
    rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [setPhase, newRace, trial]);

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
    let lastLit = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = window.matchMedia(TOUCH_LAYOUT);
    const pads = new Pads();
    sound.current ??= new RaceSound();
    view.current ??= new RaceView(PLAYER, LAPS, reduced);
    const v = view.current;
    v.sound = sound.current;
    const running = () => phaseRef.current === "racing" || phaseRef.current === "finishing";
    const moving = () => running() || phaseRef.current === "paused";
    // Before the first race the bots lap behind the (blurred) start card, so
    // the page shows a live race, not a still; in time trial, your ghost does
    // (if you have one). Not with reduced motion.
    let demo: RaceState | null = null;
    let demoPrev: RaceState | null = null;
    let demoAcc = 0;
    const stepBots = (s: RaceState, inputs: Record<string, Keys>) => {
      // A light rubber band towards you on easy and normal (see elasticStyle).
      const you = s.cars.find((c) => c.id === PLAYER);
      const yours = you ? raceProgress(you, track, s.laps) : null;
      for (const bot of BOTS[difficultyRef.current]) {
        const car = s.cars.find((c) => c.id === bot.id);
        if (!car) continue;
        const style =
          yours === null
            ? bot.style
            : elasticStyle(bot.style, raceProgress(car, track, s.laps) - yours);
        inputs[bot.id] = botKeys(car, track, style);
      }
      return inputs;
    };
    const ghostKeys = (tick: number) => decodeKeys(ghostRef.current?.keys[tick]);
    const newDemo = () =>
      trial
        ? ghostRef.current
          ? createRace(track, [GHOST_ID], LAPS)
          : null
        : createRace(track, BOT_IDS, 99);
    // Each car in its colour (yours picked on the start card), you with an outline;
    // the ghost wears yours.
    const look =
      (p: Palette) =>
      (id: string): CarLook => {
        const { body, livery } = carColor(colorsRef.current[id === GHOST_ID ? PLAYER : id] ?? 0);
        return id === PLAYER
          ? { body, livery, helmet: p.c.bolt, highlight: true }
          : { body, livery, helmet: p.c.helmet };
      };

    const finish = (s: RaceState) => {
      setResult(s);
      setPhase("finished");
      const me = s.cars.find((c) => c.id === PLAYER)!;
      if (me.finishedAt === null) return;
      const key = trial ? "trial" : difficultyRef.current;
      const lap = bestLap(me);
      const lapIndex = lap !== null ? me.lapTicks.indexOf(lap) : -1;
      const splits = lapIndex >= 0 ? (v.lapHistory[lapIndex] ?? null) : null;
      const next = updateBest(loadBest(storage(), key), me.finishedAt, lap, splits);
      saveBest(storage(), key, next.best);
      setBest(next.best);
      setOutcome({ newRace: next.newRace, newLap: next.newLap });
      // A new best run becomes the ghost to beat.
      if (trial && next.newRace) {
        const ghost = { v: GHOST_VERSION, ticks: me.finishedAt, keys: recording.current.join("") };
        saveGhost(storage(), ghost);
        ghostRef.current = ghost;
        setHasGhost(true);
      }
      const p = palette.current;
      if (trial && p && (next.newRace || medalFor(me.finishedAt) === "gold")) {
        setConfetti(makeConfetti([p.c.bolt, carColor(colorsRef.current[PLAYER] ?? 0).body]));
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(now - last, 250);
      last = now;
      const pad = pads.poll();
      if (pad.start) {
        const p = phaseRef.current;
        if (p === "ready" || p === "finished") start();
        else if (p === "paused") resume();
        else pause();
      }
      const autoGasOn = autoGasRef.current && touch.matches;
      const input = () => mergeKeys(keys.current, pad.keys, autoGasOn);

      if (phaseRef.current === "countdown" && now >= countdownEnd.current) {
        setPhase("racing");
        v.lightsOut(now);
        sound.current?.beep(true);
        setAnnouncement(t("go"));
        // From now on, "race again" gets the short lights.
        countdownMs.current = QUICK_COUNTDOWN_MS;
      }

      if (running()) {
        acc += dt;
        while (acc >= STEP_MS) {
          const s = race.current;
          const mine = input();
          if (trial) recording.current[s.tick] = encodeKeys(mine);
          const inputs = stepBots(s, { [PLAYER]: mine });
          prev.current = s;
          const next = stepRace(s, track, inputs);
          race.current = next;
          if (ghostRace.current) {
            ghostPrev.current = ghostRace.current;
            ghostRace.current = stepRace(ghostRace.current, track, {
              [GHOST_ID]: ghostKeys(s.tick),
            });
          }
          acc -= STEP_MS;
          const p = palette.current;
          if (p && v.react(next, p, now, bestRef.current.splits)) {
            setAnnouncement(t("announceLastLap"));
          }

          const me = next.cars.find((c) => c.id === PLAYER)!;
          if (phaseRef.current === "racing" && me.finishedAt !== null) {
            setPhase("finishing");
            if (!trial && !celebratedRef.current && next.finished[0] === PLAYER) {
              celebratedRef.current = true;
              if (p) {
                const cars = Object.values(colorsRef.current).map((c) => carColor(c).body);
                setConfetti(makeConfetti([p.c.bolt, ...cars]));
              }
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

      const attract = !reduced && phaseRef.current === "ready";
      if (attract) {
        demo ??= newDemo();
        if (demo) {
          demoAcc += dt;
          while (demoAcc >= STEP_MS && demo) {
            demoPrev = demo;
            const inputs = trial ? { [GHOST_ID]: ghostKeys(demo.tick) } : stepBots(demo, {});
            demo = stepRace(demo, track, inputs);
            demoAcc -= STEP_MS;
            if (palette.current) v.react(demo, palette.current, now, null);
            // The ghost's lap is over: run it again.
            if (
              trial &&
              demo.cars[0]!.finishedAt !== null &&
              demo.tick - demo.cars[0]!.finishedAt > 45
            ) {
              demo = newDemo();
              demoPrev = null;
            }
          }
        }
      } else if (demo) {
        demo = demoPrev = null;
        demoAcc = 0;
      }

      const canvas = canvasRef.current;
      const p = palette.current;
      if (canvas && p && trackLayer.current) {
        const ctx = sizeCanvas(canvas);
        const showDemo = attract && demo;
        const shown = showDemo ? demo! : race.current;
        const before = showDemo ? demoPrev : prev.current;
        const ghostCar = ghostRace.current?.cars[0];
        const l = look(p);
        v.draw(
          ctx,
          trackLayer.current,
          shown,
          before,
          showDemo ? demoAcc / STEP_MS : acc / STEP_MS,
          p,
          now,
          {
            moving: attract || moving(),
            running: attract || running(),
            look: l,
            name: names,
            zoom: zoomFor(canvas.clientWidth),
            // Phones follow your car once the lights come on.
            follow: touch.matches && !attract && phaseRef.current !== "finished",
            ghost:
              !showDemo && ghostCar
                ? {
                    car: ghostCar,
                    before: ghostPrev.current?.cars[0] ?? null,
                    look: l(GHOST_ID),
                  }
                : null,
          },
        );
      }
      if (now - hudAt > 100) {
        hudAt = now;
        const lit =
          phaseRef.current === "countdown"
            ? litLights(now - (countdownEnd.current - countdownMs.current), countdownMs.current)
            : 0;
        if (lit > lastLit) sound.current?.beep();
        lastLit = lit;
        const { hud: next, announce } = v.hud(
          race.current,
          now,
          phaseRef.current === "racing",
          lit,
        );
        setHud(next);
        if (announce && !trial)
          setAnnouncement(t("announcePosition", { place: t("ordinal", { n: announce }) }));
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      sound.current?.engine(0, false);
    };
  }, [setPhase, names, t, trial, start, pause, resume]);

  // The audio context goes with the component.
  useEffect(
    () => () => {
      sound.current?.dispose();
      sound.current = null;
    },
    [],
  );

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

  const seconds = (ticks: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
      ticks / TICK_RATE,
    );

  /** Time trial's result line: the medal you won, and how far the next one was. */
  const medalLine = (time: number | null) => {
    if (time === null) return null;
    const won = medalFor(time);
    const next = nextMedal(time);
    return (
      <div className="flex flex-col items-center gap-1 text-sm">
        {won && (
          <p className="flex items-center gap-1.5 font-medium">
            <MedalIcon id={won} className="size-5" />
            {t("medalWon", { medal: t(won) })}
          </p>
        )}
        {next && (
          <p className="text-muted">
            {t("missedBy", { gap: seconds(next.missedBy), medal: t(next.id) })}
          </p>
        )}
      </div>
    );
  };

  const myTime = result?.cars.find((c) => c.id === PLAYER)?.finishedAt ?? null;

  const results = (focus: boolean) =>
    result && (
      <ResultsCard
        rows={resultRows(standings(result, track))}
        me={PLAYER}
        place={trial ? 0 : result.finished.indexOf(PLAYER) + 1}
        myTime={myTime}
        outcome={outcome}
        name={names}
        color={colorOf}
        header={modeSwitch}
        extra={trial ? medalLine(myTime) : undefined}
        t={t}
      >
        <ColorPicker value={myColor} onChange={chooseColor} t={t} />
        {!trial && <DifficultyPicker value={difficulty} onChange={chooseDifficulty} t={t} />}
        <RestartButton
          buttonRef={focus ? restartRef : undefined}
          onClick={start}
          label={t("restart")}
          hint={t("restartHint")}
        />
      </ResultsCard>
    );

  return (
    // Standings (or, in time trial, the medals) on the left, the track in the
    // middle, lap and time on the right. Below lg the track drops under the panels.
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

      {/* Standings and times only while a race is on screen. */}
      {onTrack &&
        (trial ? (
          <MedalPanel record={best.race} t={t} />
        ) : (
          <StandingsBoard board={hud.board} me={PLAYER} name={names} color={colorOf} t={t} />
        ))}
      {onTrack && <LapPanel hud={hud} laps={LAPS} best={best} t={t} />}

      <div className={TRACK_COLUMN}>
        {onTrack && <CompactHud hud={hud} me={PLAYER} laps={LAPS} showPlace={!trial} t={t} />}
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

          {!trial && phase === "finishing" && hud.place > 0 && (
            <FinishingVeil place={hud.place} onSkip={skip} t={t} />
          )}

          {/* The countdown has no veil: the grid and the lights stay in full view. */}
          {(phase === "ready" || phase === "paused" || phase === "finished") && (
            <div className={VEIL}>
              {phase === "ready" && (
                <StartCard header={modeSwitch} slideFrom={slideFrom}>
                  {/* Phones: the track is too short for the legend too; it goes under the controls. */}
                  <div className="w-full max-lg:hidden">
                    <Controls />
                  </div>
                  {/* Phones: the colour goes under the track too (the card must fit over it). */}
                  <div className="max-lg:hidden">
                    <ColorPicker value={myColor} onChange={chooseColor} t={t} />
                  </div>
                  {trial ? (
                    <div className="flex w-full max-w-56 flex-col items-center gap-2">
                      <MedalTargets record={best.race} t={t} className="w-full text-left" />
                      {hasGhost && (
                        <p className="text-xs text-muted max-lg:hidden">{t("ghostLegend")}</p>
                      )}
                    </div>
                  ) : (
                    <DifficultyPicker value={difficulty} onChange={chooseDifficulty} t={t} />
                  )}
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

          <TrackButtons phoneHidden={!onTrack}>
            {(phase === "racing" || phase === "finishing") && <PauseButton onClick={pause} t={t} />}
            <SoundButton on={soundOn} onToggle={toggleSound} t={t} />
          </TrackButtons>
        </div>

        {/* Below lg the results don't fit over the track: they take the touch controls' place. */}
        {phase === "finished" && (
          <div className="mt-4 flex justify-center lg:hidden">{results(false)}</div>
        )}

        {phase === "ready" && (
          <div className="mt-4 lg:hidden">
            <ColorPicker value={myColor} onChange={chooseColor} t={t} />
          </div>
        )}
        {phase === "ready" && (
          <p className="mt-4 text-center text-xs text-muted lg:hidden">{t("controlsTouch")}</p>
        )}
        <TouchPad
          press={press}
          hidden={phase === "finished"}
          autoGas={autoGas}
          onAutoGas={chooseAutoGas}
          t={t}
        />
        {phase === "ready" && (
          <div className="mt-6 lg:hidden">
            <Controls />
          </div>
        )}
      </div>
    </div>
  );
}
