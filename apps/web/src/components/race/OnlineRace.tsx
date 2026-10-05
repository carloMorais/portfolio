"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  NO_KEYS,
  RaceDecoder,
  classicTrack as track,
  createRace,
  standings,
  type Car,
  type Difficulty,
  type Keys,
  type RaceState,
} from "race-engine";
import { carColor } from "./colors";
import { interpolateCar, readPalette, type CarLook, type Palette } from "./draw";
import {
  CompactHud,
  FinishingVeil,
  LapPanel,
  RACE_GRID,
  ResultsCard,
  RestartButton,
  StandingsBoard,
  Spinner,
  ColorPicker,
  CAR_TEXT,
  carText,
  StartCard,
  TRACK_COLUMN,
  TouchPad,
  TrackOverlays,
  VEIL,
  makeConfetti,
  type ConfettiPiece,
  type SlideFrom,
} from "./hud";
import {
  apiWsUrl,
  applyServerMessage,
  initialOnlineState,
  inviteUrl,
  isLeader,
  colorIndex,
  type ClientMessage,
  type OnlineState,
  type ServerMessage,
} from "./online";
import { KeyTimeline, Predictor, Rtt, SnapshotBuffer, Smoother } from "./net";
import {
  DIFFICULTIES,
  bestLap,
  loadBest,
  resultRows,
  saveBest,
  saveColor,
  loadColor,
  storage,
  updateBest,
  type PersonalBest,
} from "./session";
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

/** How long "couldn't complete that action" stays up before fading. */
const ERROR_MS = 3000;
/** After this long still connecting, the Render cold-start hint shows up. */
const COLD_START_MS = 4000;
/** The mode card's slide (globals.css, .race-slide-from-*). */
const SLIDE_MS = 450;

/** Runs `fn` after the next paint (rAF fires before it, the timeout after); returns a cancel. */
function afterPaint(fn: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const raf = requestAnimationFrame(() => (timer = setTimeout(fn, 0)));
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  };
}
/** How long "link copied" stays up. */
const COPIED_MS = 2000;
/** How often the round trip is measured (also keeps idle lobby connections alive). */
const PING_MS = 2000;
/** The server's "try again later" close code: it's at its connection limit (see the API's limits.ts). */
const CLOSE_BUSY = 1013;

const racerNumber = (s: OnlineState, id: string) =>
  s.numbers[id] ?? s.participants.find((p) => p.id === id)?.number ?? 0;

const nameIn = (s: OnlineState, id: string, t: ReturnType<typeof useTranslations<"Play">>) =>
  id === s.playerId ? t("you") : t("bot", { n: racerNumber(s, id) });
const EMPTY = createRace(track, [], 2);

type Outcome = { newRace: boolean; newLap: boolean };

/**
 * Online mode: the race itself runs on the server (`apps/api`'s WebSocket
 * gateway), 30 ticks/s. Everything practice mode shows — start lights,
 * effects, the next checkpoint, wrong way, last lap, live standings, sector
 * delta, lap times, record, confetti, results — is drawn here from the
 * server's ticks with the same `RaceView` and HUD. No bots are computed here,
 * and no pause either: the race goes on for everyone.
 *
 * How the cars are drawn (see net.ts): the server's states arrive ~15 times a
 * second in a compact format (`RaceDecoder`); the other cars are shown a
 * little in the past, interpolated between two real states (`SnapshotBuffer`),
 * and yours is predicted ahead by running the engine locally with the keys
 * you sent (`Predictor`), so it answers at once instead of a round trip
 * later. Rankings, laps and warnings always come from the server's state.
 */
export function OnlineRace({
  invite,
  onPracticeInstead,
  modeSwitch,
  slideFrom,
  onBusy,
}: {
  /**
   * Connecting: every button on the card waits (the mode switch too, see
   * RaceModeSwitcher) until the server answers, or until the wake-up hint
   * offers to practise meanwhile.
   */
  onBusy: (busy: boolean) => void;
  /** A room code from an invite link (`?room=`), or null for any open room. */
  invite: string | null;
  /** While the server wakes up, the visitor can race the bots instead. */
  onPracticeInstead: () => void;
  /** The practice/online switch, on top of the lobby and results cards. */
  modeSwitch: ReactNode;
  slideFrom: SlideFrom;
}) {
  const t = useTranslations("Online");
  const tPlay = useTranslations("Play");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackLayer = useRef<HTMLCanvasElement | null>(null);
  const palette = useRef<Palette | null>(null);
  const keysRef = useRef<Keys>({ ...NO_KEYS });
  /** The latest server state (rankings, laps, warnings) or, before the race, the grid. */
  const race = useRef<RaceState>(EMPTY);
  const decoder = useRef<RaceDecoder | null>(null);
  const buffer = useRef(new SnapshotBuffer());
  const timeline = useRef(new KeyTimeline());
  const predictor = useRef(new Predictor());
  const smoother = useRef(new Smoother());
  const rtt = useRef(new Rtt());
  const wsRef = useRef<WebSocket | null>(null);
  const view = useRef<RaceView | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const countdownEnd = useRef<number | null>(null);
  const countdownMs = useRef(0);
  const doneRef = useRef(false);
  /** The record is updated once per race, whether you skip to the results or not. */
  const recordedRef = useRef(false);
  const bestRef = useRef<PersonalBest>({ race: null, lap: null, splits: null });

  const [state, dispatch] = useReducer(applyServerMessage, initialOnlineState);
  /** The first connection waits for the mode's card to slide in; reconnecting doesn't. */
  const connectDelay = useRef(slideFrom ? SLIDE_MS : 0);
  const stateRef = useRef(state);
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [transientError, setTransientError] = useState<string | null>(null);
  const [showColdStartHint, setShowColdStartHint] = useState(false);
  /** Seconds spent connecting, shown while the server wakes up. */
  const [waited, setWaited] = useState(0);
  /** The invite's room had already started (or was full): you're in a new one. */
  const [inviteMissed, setInviteMissed] = useState(false);
  const [copied, setCopied] = useState(false);
  /**
   * The room to ask for on the next connection: the invite's, then the one
   * you were in, so friends who all press "play again" meet again.
   */
  const roomRef = useRef(invite);
  const [hud, setHud] = useState<Hud>(() => emptyHud(EMPTY));
  const [result, setResult] = useState<RaceState | null>(null);
  const [best, setBest] = useState<PersonalBest>({ race: null, lap: null, splits: null });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confetti, setConfetti] = useState<ConfettiPiece[] | null>(null);

  useEffect(() => {
    stateRef.current = state;
    if (view.current && state.playerId) view.current.me = state.playerId;
  }, [state]);
  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  // Online races keep one record of their own, in this browser only.
  useEffect(() => {
    const id = requestAnimationFrame(() => setBest(loadBest(storage(), "online")));
    return () => cancelAnimationFrame(id);
  }, []);

  /** Everyone is "Piloto N" in your language, except you. The draw loop reads the latest state. */
  const names = useCallback((id: string) => nameIn(stateRef.current, id, tPlay), [tPlay]);
  const renderName = (id: string) => nameIn(state, id, tPlay);
  const colorOf = (id: string) => carColor(colorIndex(state, id));

  // In the lobby, everyone who's in waits on the grid.
  useEffect(() => {
    if (state.phase !== "lobby") return;
    race.current = createRace(
      track,
      state.participants.map((p) => p.id),
      state.laps,
    );
  }, [state.phase, state.participants, state.laps]);

  // Track and colours, same renderer as practice mode.
  useEffect(() => {
    const build = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      palette.current = readPalette(canvas);
      trackLayer.current = buildTrackLayer(palette.current);
    };
    // After the switch to this mode has painted: drawing the track takes a moment.
    const cancel = afterPaint(build);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", build);
    return () => {
      cancel();
      media.removeEventListener("change", build);
    };
  }, []);

  const finish = useCallback((s: RaceState) => {
    setResult(s);
    const me = s.cars.find((c) => c.id === stateRef.current.playerId);
    if (!me || me.finishedAt === null || recordedRef.current) return;
    recordedRef.current = true;
    const lap = bestLap(me);
    const lapIndex = lap !== null ? me.lapTicks.indexOf(lap) : -1;
    const splits = lapIndex >= 0 ? (view.current?.lapHistory[lapIndex] ?? null) : null;
    const next = updateBest(loadBest(storage(), "online"), me.finishedAt, lap, splits);
    saveBest(storage(), "online", next.best);
    setBest(next.best);
    setOutcome({ newRace: next.newRace, newLap: next.newLap });
  }, []);

  // The WebSocket connection: one room per connection, no resume on reconnect yet.
  useEffect(() => {
    let live = true;
    race.current = EMPTY;
    decoder.current = null;
    buffer.current.clear();
    predictor.current.clear();
    const coldStartTimer = setTimeout(() => setShowColdStartHint(true), COLD_START_MS);
    const connectedAt = performance.now();
    const waitTimer = setInterval(
      () => setWaited(Math.floor((performance.now() - connectedAt) / 1000)),
      1000,
    );
    const requested = roomRef.current;
    /** Your saved colour is asked for once, on the first lobby (if nobody else has it). */
    let colorAsked = false;
    /** Our car, straight from `welcome` (the lobby can arrive before React has stored it). */
    let myId: string | null = null;
    let socket: WebSocket | null = null;
    let pinger: ReturnType<typeof setInterval> | undefined;

    // The mode switch shows first: the socket opens once the online card has
    // painted (and, when it slides in, once it has slid), never before.
    const connect = () => {
      if (!live) return;
      const ws = new WebSocket(apiWsUrl(requested));
      socket = ws;
      wsRef.current = ws;
      const ping = () =>
        ws.readyState === WebSocket.OPEN &&
        ws.send(JSON.stringify({ event: "ping", data: performance.now() }));
      ws.addEventListener("open", ping);
      pinger = setInterval(ping, PING_MS);

      ws.addEventListener("message", (event) => {
        if (!live) return;
        const msg = JSON.parse(event.data as string) as ServerMessage;
        const now = performance.now();
        const v = view.current;
        const me = stateRef.current.playerId;
        if (msg.type === "welcome") {
          myId = msg.playerId;
          clearInterval(waitTimer);
          setInviteMissed(requested !== null && requested !== msg.roomId);
          roomRef.current = msg.roomId;
          // The address bar is an invite too: copy it and send it.
          window.history.replaceState(null, "", inviteUrl(window.location.href, msg.roomId));
        }
        if (msg.type === "lobby" && !colorAsked) {
          colorAsked = true;
          const wanted = loadColor(storage());
          const mine = msg.participants.find((p) => p.id === myId);
          const held = msg.participants.some(
            (p) => !p.isBot && p.id !== myId && p.color === wanted,
          );
          if (wanted !== null && mine && mine.color !== wanted && !held) {
            ws.send(JSON.stringify({ event: "color", data: { color: wanted } }));
          }
        }
        if (msg.type === "pong") {
          rtt.current.sample(now - msg.t);
          return;
        }
        if (msg.type === "state") {
          if (!decoder.current) return;
          race.current = decoder.current.apply(msg);
          buffer.current.push(race.current, now);
          // Re-base the prediction on the server's truth; the smoother hides the correction.
          if (me) {
            predictor.current.reset(race.current, now, me);
            smoother.current.correct(
              predictor.current.at(now, rtt.current.value, (t) => timeline.current.keysAt(t)),
            );
          }
          const p = palette.current;
          if (v && p && v.react(race.current, p, now, bestRef.current.splits)) {
            setAnnouncement(tPlay("announceLastLap"));
          }
          const mine = race.current.cars.find((c) => c.id === me);
          if (mine && mine.finishedAt !== null && !doneRef.current) {
            doneRef.current = true;
            dispatch({ type: "you-finished" });
            if (race.current.finished[0] === me && p) {
              const cars = race.current.cars.map(
                (c) => carColor(colorIndex(stateRef.current, c.id)).body,
              );
              setConfetti(makeConfetti([p.c.bolt, ...cars]));
            }
          }
          return;
        }
        if (msg.type === "error") {
          setTransientError(msg.message);
          setTimeout(() => setTransientError(null), ERROR_MS);
          return;
        }
        if (msg.type === "start") {
          decoder.current = new RaceDecoder(track, msg.carIds, stateRef.current.laps);
          race.current = decoder.current.initial();
          buffer.current.clear();
          timeline.current.clear();
          predictor.current.clear();
          smoother.current.clear();
          keysRef.current = { ...NO_KEYS };
          v?.reset();
          doneRef.current = false;
          recordedRef.current = false;
          countdownMs.current = msg.countdownMs;
          countdownEnd.current = now + msg.countdownMs;
          setResult(null);
          setOutcome(null);
          setConfetti(null);
          canvasRef.current?.focus({ preventScroll: true });
          // Bring the whole track into view: you can't drive what you can't see.
          rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        }
        if (msg.type === "finished") finish(race.current);
        dispatch(msg);
      });
      ws.addEventListener(
        "close",
        (e) => live && dispatch({ type: "room-closed", busy: e.code === CLOSE_BUSY }),
      );
      ws.addEventListener("error", () => live && dispatch({ type: "room-closed" }));
    };
    const delay = connectDelay.current;
    connectDelay.current = 0;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelPaint = afterPaint(() => (delayTimer = setTimeout(connect, delay)));

    return () => {
      live = false;
      clearTimeout(coldStartTimer);
      clearInterval(waitTimer);
      cancelPaint();
      clearTimeout(delayTimer);
      clearInterval(pinger);
      socket?.close();
      wsRef.current = null;
    };
  }, [connectAttempt, finish, tPlay]);

  const send = (message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(message));
  };

  /**
   * Sends the keys held now, and notes when: the predictor replays exactly
   * what the server will apply, so the timeline has to match what was sent.
   */
  const sendKeys = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ event: "input", data: keysRef.current }));
    timeline.current.record(performance.now(), keysRef.current);
  }, []);

  const reconnect = useCallback(() => {
    setShowColdStartHint(false);
    setWaited(0);
    setInviteMissed(false);
    setResult(null);
    setConfetti(null);
    setOutcome(null);
    setHud(emptyHud(EMPTY));
    dispatch({ type: "reconnect" });
    setConnectAttempt((n) => n + 1);
  }, []);

  // Keyboard: driving keys (sent on change, not every frame) during the lights
  // and the race; Enter starts (leader) or plays again, and so does R.
  useEffect(() => {
    const driving = () => {
      const p = stateRef.current.phase;
      return p === "countdown" || p === "racing";
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = stateRef.current;
      if (!e.repeat) {
        const over = s.phase === "finished" || s.phase === "disconnected";
        if (e.code === "KeyR" && over) {
          e.preventDefault();
          reconnect();
          return;
        }
        // A focused button already answers Enter with a click.
        if (e.code === "Enter" && !(e.target instanceof HTMLButtonElement)) {
          if (over) reconnect();
          if (s.phase === "lobby" && isLeader(s) && s.participants.length >= 2) {
            wsRef.current?.send(JSON.stringify({ event: "start" }));
          }
          return;
        }
      }
      const key = KEY_MAP[e.code];
      if (!key || !driving()) return;
      e.preventDefault();
      if (keysRef.current[key]) return;
      keysRef.current = { ...keysRef.current, [key]: true };
      sendKeys();
    };
    const onUp = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (!key || !keysRef.current[key]) return;
      keysRef.current = { ...keysRef.current, [key]: false };
      sendKeys();
    };
    // Leaving the tab or the window lets go of every key (the race can't pause).
    const away = () => {
      keysRef.current = { ...NO_KEYS };
      if (driving() || stateRef.current.phase === "finishing") sendKeys();
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
  }, [reconnect, sendKeys]);

  // The results take the keyboard focus, so Enter races again.
  useEffect(() => {
    if (state.phase === "finished") restartRef.current?.focus({ preventScroll: true });
  }, [state.phase]);

  const press = (key: keyof Keys, down: boolean) => {
    keysRef.current = { ...keysRef.current, [key]: down };
    sendKeys();
  };

  // Draw loop: others interpolated from the buffer, you predicted (see net.ts).
  useEffect(() => {
    let raf = 0;
    let hudAt = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    view.current ??= new RaceView(stateRef.current.playerId ?? "", stateRef.current.laps, reduced);
    const v = view.current;
    // Each car in the colour its driver picked (or was given); you with a stripe and an outline.
    const look =
      (p: Palette) =>
      (id: string): CarLook => {
        const s = stateRef.current;
        if (id === s.playerId) {
          return {
            body: carColor(colorIndex(s, id)).body,
            helmet: p.c.bolt,
            stripe: true,
            highlight: true,
          };
        }
        return { body: carColor(colorIndex(s, id)).body, helmet: p.c.helmet, stripe: false };
      };

    /** The latest server state with every car where it should be drawn at `now`. */
    const shownState = (now: number): RaceState => {
      const s = race.current;
      const sample = buffer.current.sample(now);
      if (!sample) return s; // lobby, lights: the grid as it is
      const me = stateRef.current.playerId;
      const predicted = predictor.current.at(now, rtt.current.value, (t) =>
        timeline.current.keysAt(t),
      );
      const cars = s.cars.map((car): Car => {
        if (car.id === me && predicted) return smoother.current.apply(predicted, now);
        const a = sample.a.cars.find((c) => c.id === car.id);
        const b = sample.b.cars.find((c) => c.id === car.id) ?? car;
        return interpolateCar(a, b, sample.alpha);
      });
      return { ...s, cars };
    };

    const frame = (now: number) => {
      const phase = stateRef.current.phase;
      if (countdownEnd.current !== null && now >= countdownEnd.current) {
        countdownEnd.current = null;
        dispatch({ type: "lights-out" });
        v.lightsOut(now);
        setAnnouncement(tPlay("go"));
      }
      const running = phase === "racing" || phase === "finishing" || phase === "finished";

      const canvas = canvasRef.current;
      const p = palette.current;
      if (canvas && p && trackLayer.current) {
        const ctx = sizeCanvas(canvas);
        // Positions are already worked out per car (shownState), so the view draws them as given.
        v.draw(ctx, trackLayer.current, shownState(now), null, 0, p, now, {
          moving: false,
          running,
          look: look(p),
          name: names,
          zoom: zoomFor(canvas.clientWidth),
        });
      }
      const me = stateRef.current.playerId;
      if (now - hudAt > 100 && me && race.current.cars.some((c) => c.id === me)) {
        hudAt = now;
        const lit =
          phase === "countdown" && countdownEnd.current !== null
            ? litLights(now - (countdownEnd.current - countdownMs.current))
            : 0;
        const { hud: next, announce } = v.hud(race.current, now, phase === "racing", lit);
        setHud(next);
        if (announce) {
          setAnnouncement(tPlay("announcePosition", { place: tPlay("ordinal", { n: announce }) }));
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [names, tPlay]);

  const skip = () => {
    finish(race.current);
    dispatch({ type: "skip" });
  };

  const copyInvite = async () => {
    if (!state.roomId) return;
    try {
      await navigator.clipboard.writeText(inviteUrl(window.location.href, state.roomId));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // No clipboard (an insecure context, a refused permission): the address bar has the link.
    }
  };

  const busy = state.phase === "connecting" && !showColdStartHint;
  useEffect(() => onBusy(busy), [busy, onBusy]);
  useEffect(() => () => onBusy(false), [onBusy]);

  const leading = isLeader(state);
  const enough = state.participants.length >= 2;
  const me = state.playerId ?? "";
  const phase = state.phase;
  const inRace = phase === "countdown" || phase === "racing" || phase === "finishing";
  /** Not in a race: the card (connecting, lobby, connection lost) is up. */
  const outside = phase === "connecting" || phase === "lobby" || phase === "disconnected";

  // Outside a race, one card: connecting, the lobby, or the connection lost.
  // On lg it sits over the track; below it there's no room, so it goes under it.
  const card = (
    <StartCard header={modeSwitch} slideFrom={slideFrom}>
      {phase === "connecting" && (
        <div className="flex flex-col items-center gap-3" role="status">
          <p className="flex items-center gap-3 font-display text-2xl tracking-tight">
            <Spinner />
            {t("connecting")}
            {showColdStartHint && <span className="ml-2 text-muted tabular-nums">{waited} s</span>}
          </p>
          {showColdStartHint && (
            <>
              <p className="max-w-xs text-sm text-muted">{t("coldStartHint")}</p>
              <button
                type="button"
                onClick={onPracticeInstead}
                className="btn btn-ghost mt-1 text-sm"
              >
                {t("practiceMeanwhile")}
              </button>
            </>
          )}
        </div>
      )}

      {phase === "disconnected" && (
        <div className="flex flex-col items-center gap-3">
          <p className="font-display text-2xl tracking-tight">{t("disconnected")}</p>
          {/* Turned away at the door (connection limit): say so, not just "lost". */}
          {state.busy && <p className="max-w-xs text-sm text-muted">{t("serverBusy")}</p>}
          <button type="button" onClick={reconnect} className="btn btn-primary">
            {t("reconnect")}
          </button>
        </div>
      )}

      {phase === "lobby" && (
        <>
          {/* The room you're in, and its invite link right beside it. */}
          {state.roomId && (
            <div className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm">
              <span className="text-muted">
                {t("room")} <span className="font-medium text-ink">{state.roomId}</span>
              </span>
              <button
                type="button"
                onClick={copyInvite}
                className="rounded-full bg-bg px-3 py-1 text-xs font-medium text-accent ring-1 ring-line transition-colors hover:ring-ink"
              >
                {copied ? t("inviteCopied") : t("inviteCopy")}
              </button>
              <span role="status" className="sr-only">
                {copied ? t("inviteCopied") : ""}
              </span>
            </div>
          )}
          {inviteMissed && <p className="text-sm text-muted">{t("inviteMissed")}</p>}
          <ul className="w-full space-y-1.5 text-left text-sm">
            {state.participants.map((p) => (
              <li
                key={p.id}
                className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-1.5 ring-1 ring-line"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-3 rounded-full ring-1 ring-black/15"
                    style={{ backgroundColor: colorOf(p.id).body }}
                  />
                  <span
                    className={`${CAR_TEXT} ${p.id === state.playerId ? "font-semibold" : ""}`}
                    style={carText(colorOf(p.id))}
                  >
                    {renderName(p.id)}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {p.id === state.leaderId && (
                    <span className="text-accent">{t("leaderBadge")}</span>
                  )}
                  {p.isBot && <span>{t("botBadge")}</span>}
                  {/* Each bot drives at its own difficulty; only the leader sets it. */}
                  {p.isBot &&
                    (leading ? (
                      <select
                        aria-label={t("botDifficulty", { name: renderName(p.id) })}
                        value={p.difficulty ?? "normal"}
                        onChange={(e) =>
                          send({
                            event: "bot-difficulty",
                            data: { bot: p.id, difficulty: e.target.value as Difficulty },
                          })
                        }
                        className="rounded-md bg-bg py-1 pr-1 pl-2 text-xs text-ink ring-1 ring-line"
                      >
                        {DIFFICULTIES.map((d) => (
                          <option key={d} value={d}>
                            {tPlay(d)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-ink">{tPlay(p.difficulty ?? "normal")}</span>
                    ))}
                </span>
              </li>
            ))}
          </ul>
          <ColorPicker
            value={colorIndex(state, me)}
            taken={state.participants
              .filter((p) => !p.isBot && p.id !== state.playerId)
              .map((p) => p.color)}
            onChange={(color) => {
              saveColor(storage(), color);
              send({ event: "color", data: { color } });
            }}
            t={tPlay}
          />
          {leading && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => send({ event: "add-bot" })}
                className="btn btn-ghost px-4 py-2 text-sm"
              >
                {t("addBot")}
              </button>
              <button
                type="button"
                onClick={() => send({ event: "remove-bot" })}
                disabled={!state.participants.some((p) => p.isBot)}
                className="btn btn-ghost px-4 py-2 text-sm disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line"
              >
                {t("removeBot")}
              </button>
            </div>
          )}
          {leading ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => send({ event: "start" })}
                disabled={!enough}
                className="btn btn-primary disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
              >
                {tPlay("start")}
              </button>
              {enough ? (
                <p className="hidden text-xs text-muted lg:block">{tPlay("startHint")}</p>
              ) : (
                <p className="text-xs text-muted">{t("needTwoPlayers")}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">{t("waitingForLeader")}</p>
          )}
          {transientError && (
            <p className="text-xs text-accent">
              {state.busy ? t("serverBusy") : t("actionFailed")}
            </p>
          )}
        </>
      )}
    </StartCard>
  );

  const results = (focus: boolean) =>
    result && (
      <ResultsCard
        rows={resultRows(standings(result, track))}
        me={me}
        place={result.finished.indexOf(me) + 1}
        myTime={result.cars.find((c) => c.id === me)?.finishedAt ?? null}
        outcome={outcome}
        name={renderName}
        color={colorOf}
        header={modeSwitch}
        t={tPlay}
      >
        <RestartButton
          buttonRef={focus ? restartRef : undefined}
          onClick={reconnect}
          label={t("playAgain")}
          hint={tPlay("restartHint")}
        />
      </ResultsCard>
    );

  return (
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
      {inRace && (
        <StandingsBoard
          board={hud.board}
          me={state.playerId}
          name={renderName}
          color={colorOf}
          t={tPlay}
        />
      )}
      {inRace && <LapPanel hud={hud} laps={state.laps} best={best} t={tPlay} />}

      <div className={TRACK_COLUMN}>
        {inRace && <CompactHud hud={hud} me={state.playerId} laps={state.laps} t={tPlay} />}
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
            t={tPlay}
          />

          {phase === "finishing" && hud.place > 0 && (
            <FinishingVeil place={hud.place} onSkip={skip} t={tPlay} />
          )}

          {(phase === "connecting" ||
            phase === "lobby" ||
            phase === "disconnected" ||
            phase === "finished") && (
            <div className={VEIL}>
              {outside && <div className="hidden w-full justify-center lg:flex">{card}</div>}
              {phase === "finished" && (
                <div className="hidden w-full justify-center lg:flex">{results(true)}</div>
              )}
            </div>
          )}
        </div>

        {outside && <div className="mt-4 flex justify-center lg:hidden">{card}</div>}

        {/* Below lg the results don't fit over the track: they take the touch controls' place. */}
        {phase === "finished" && (
          <div className="mt-4 flex justify-center lg:hidden">{results(false)}</div>
        )}

        <TouchPad press={press} hidden={!inRace} t={tPlay} />
      </div>
    </div>
  );
}
