"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NO_KEYS, classicTrack as track, type Keys } from "race-engine";
import {
  drawCar,
  drawItem,
  drawLabel,
  drawTrack,
  readPalette,
  type CarLook,
  type Palette,
} from "./draw";
import { drawScenery } from "./scenery";
import { formatTime } from "./session";
import { KEY_MAP } from "./PracticeRace";
import { TouchButton } from "./TouchControls";
import { BoltIcon } from "./icons";
import {
  apiWsUrl,
  applyServerMessage,
  initialOnlineState,
  isLeader,
  type CarSnapshot,
  type ClientMessage,
  type ServerMessage,
} from "./online";

const STEP_MS = 1000 / 30;
/** How long "couldn't complete that action" stays up before fading. */
const ERROR_MS = 3000;
/** After this long still connecting, the Render cold-start hint shows up. */
const COLD_START_MS = 4000;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function interpolateSnapshot(prev: CarSnapshot | undefined, next: CarSnapshot, t: number) {
  if (!prev) return next;
  if (Math.abs(prev.x - next.x) > 40 || Math.abs(prev.y - next.y) > 40) return next;
  let dr = next.rotation - prev.rotation;
  if (dr > 180) dr -= 360;
  if (dr < -180) dr += 360;
  return {
    ...next,
    x: lerp(prev.x, next.x, t),
    y: lerp(prev.y, next.y, t),
    rotation: prev.rotation + dr * t,
  };
}

type LiveHud = { tick: number; cars: CarSnapshot[] };

/**
 * Online mode: the race itself runs on the server (`apps/api`'s WebSocket
 * gateway), 30 ticks/s; this draws the same track with the same renderer as
 * practice mode, interpolating between the last two snapshots it received.
 * No local physics, no bots computed here — just a lobby, input, and drawing.
 */
export function OnlineRace() {
  const t = useTranslations("Online");
  const tPlay = useTranslations("Play");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackLayer = useRef<HTMLCanvasElement | null>(null);
  const palette = useRef<Palette | null>(null);
  const keysRef = useRef<Keys>({ ...NO_KEYS });
  const carsRef = useRef<{ prev: CarSnapshot[] | null; current: CarSnapshot[]; at: number }>({
    prev: null,
    current: [],
    at: 0,
  });
  const itemsRef = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const phaseRef = useRef(initialOnlineState.phase);
  const myIdRef = useRef<string | null>(null);

  const [state, dispatch] = useReducer(applyServerMessage, initialOnlineState);
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [transientError, setTransientError] = useState<string | null>(null);
  const [showColdStartHint, setShowColdStartHint] = useState(false);
  const [liveHud, setLiveHud] = useState<LiveHud>({ tick: 0, cars: [] });

  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);
  useEffect(() => {
    myIdRef.current = state.playerId;
  }, [state.playerId]);

  // Track and colours, same renderer as practice mode.
  useEffect(() => {
    const build = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      palette.current = readPalette(canvas);
      const layer = document.createElement("canvas");
      layer.width = track.width;
      layer.height = track.height;
      const lctx = layer.getContext("2d")!;
      drawTrack(lctx, track, palette.current);
      drawScenery(lctx, palette.current);
      trackLayer.current = layer;
    };
    build();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", build);
    return () => media.removeEventListener("change", build);
  }, []);

  // The WebSocket connection: one room per connection, no resume on reconnect yet.
  useEffect(() => {
    carsRef.current = { prev: null, current: [], at: 0 };
    itemsRef.current = new Set();
    const coldStartTimer = setTimeout(() => setShowColdStartHint(true), COLD_START_MS);

    const ws = new WebSocket(apiWsUrl());
    wsRef.current = ws;

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      if (msg.type === "state") {
        carsRef.current = {
          prev: carsRef.current.current,
          current: msg.cars,
          at: performance.now(),
        };
        itemsRef.current = new Set(msg.items);
        setLiveHud({ tick: msg.tick, cars: msg.cars });
        return;
      }
      if (msg.type === "error") {
        setTransientError(msg.message);
        setTimeout(() => setTransientError(null), ERROR_MS);
        return;
      }
      dispatch(msg);
    });
    const onLost = () => dispatch({ type: "room-closed" });
    ws.addEventListener("close", onLost);
    ws.addEventListener("error", onLost);

    return () => {
      clearTimeout(coldStartTimer);
      ws.close();
      wsRef.current = null;
    };
  }, [connectAttempt]);

  const send = (message: ClientMessage) => wsRef.current?.send(JSON.stringify(message));

  // Driving keys, only while racing; sent on change, not every frame.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const key = KEY_MAP[e.code];
      if (!key || phaseRef.current !== "racing") return;
      e.preventDefault();
      keysRef.current = { ...keysRef.current, [key]: true };
      send({ event: "input", data: keysRef.current });
    };
    const onUp = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (!key) return;
      keysRef.current = { ...keysRef.current, [key]: false };
      if (phaseRef.current === "racing") send({ event: "input", data: keysRef.current });
    };
    const away = () => {
      if (phaseRef.current !== "racing") return;
      keysRef.current = { ...NO_KEYS };
      send({ event: "input", data: keysRef.current });
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", away);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", away);
    };
  }, []);

  const press = (key: keyof Keys, down: boolean) => {
    keysRef.current = { ...keysRef.current, [key]: down };
    send({ event: "input", data: keysRef.current });
  };

  // Draw loop: interpolates between the last two server snapshots.
  useEffect(() => {
    let raf = 0;
    const names = (id: string, number: number) =>
      id === myIdRef.current ? tPlay("you") : tPlay("bot", { n: number });

    const draw = (now: number) => {
      const canvas = canvasRef.current;
      const p = palette.current;
      if (!canvas || !p || !trackLayer.current) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const w = track.width * dpr;
      if (canvas.width !== w) {
        canvas.width = w;
        canvas.height = track.height * dpr;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(trackLayer.current, 0, 0);

      if (phaseRef.current === "racing" || phaseRef.current === "finished") {
        const { prev, current, at } = carsRef.current;
        const alpha = Math.min(1, (now - at) / STEP_MS);
        const active = track.items.filter((it) => itemsRef.current.has(it.id));
        for (const item of active) drawItem(ctx, item, p, Math.sin(now / 450));

        const numbers = state.numbers;
        const ordered = [
          ...current.filter((c) => c.id !== myIdRef.current),
          ...current.filter((c) => c.id === myIdRef.current),
        ].map((car) => {
          const before = prev?.find((c) => c.id === car.id);
          return { car, at: interpolateSnapshot(before, car, alpha) };
        });
        for (const { car, at: pos } of ordered) {
          const mine = car.id === myIdRef.current;
          const look: CarLook = mine
            ? { body: p.accent, helmet: p.c.bolt, stripe: true, highlight: true }
            : {
                body: p.c.bots[(numbers[car.id] ?? 0) % p.c.bots.length]!,
                helmet: p.c.helmet,
                stripe: false,
              };
          drawCar(ctx, { ...pos, width: 25, height: 25 }, look, p, false);
        }
        for (const { car, at: pos } of ordered) {
          drawLabel(
            ctx,
            { ...pos, width: 25, height: 25 },
            names(car.id, numbers[car.id] ?? 0),
            car.nitro,
            p,
            track.width,
            null,
            car.id === myIdRef.current,
          );
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [state.numbers, tPlay]);

  const reconnect = () => setConnectAttempt((n) => n + 1);
  const leading = isLeader(state);
  const totalParticipants = state.participants.length;
  const me = liveHud.cars.find((c) => c.id === state.playerId);

  return (
    <div className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-4 lg:grid-cols-[10rem_minmax(0,1fr)_6.5rem] lg:gap-x-6">
      <table className="col-start-1 row-start-1 self-start text-sm tabular-nums">
        <caption className="sr-only">{tPlay("standings")}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="pr-3 pb-2 font-normal">
              {tPlay("place")}
            </th>
            <th scope="col" className="pr-3 pb-2 font-normal">
              {tPlay("driver")}
            </th>
            <th scope="col" className="pb-2 font-normal">
              {tPlay("lap")}
            </th>
          </tr>
        </thead>
        <tbody>
          {[...liveHud.cars]
            .sort((a, b) => b.laps - a.laps)
            .map((c, i) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="py-2 pr-3 text-muted">{i + 1}</td>
                <th
                  scope="row"
                  className={`py-2 pr-3 text-left font-normal whitespace-nowrap ${c.id === state.playerId ? "text-accent" : ""}`}
                >
                  {c.id === state.playerId
                    ? tPlay("you")
                    : tPlay("bot", { n: state.numbers[c.id] ?? 0 })}
                  {c.finishedAt !== null && (
                    <span className="ml-1.5 text-xs text-muted">· {tPlay("done")}</span>
                  )}
                </th>
                <td className="py-2">
                  {c.laps}/{state.laps}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      <dl className="col-start-2 row-start-1 flex flex-col gap-4 self-start tabular-nums lg:col-start-3">
        <div>
          <dt className="text-xs text-muted">{tPlay("lap")}</dt>
          <dd className="font-display text-3xl tracking-tight">
            {Math.min(state.laps, (me?.laps ?? 0) + 1)}
            <span className="text-muted">/{state.laps}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{tPlay("time")}</dt>
          <dd className="font-display text-3xl tracking-tight">{formatTime(liveHud.tick)}</dd>
        </div>
      </dl>

      <div className="col-span-2 row-start-2 mx-auto w-full max-w-[calc((100svh-6rem)*760/600)] lg:col-span-1 lg:col-start-2 lg:row-start-1">
        <div className="relative overflow-hidden rounded-[var(--radius-photo)] ring-1 ring-line">
          <canvas
            ref={canvasRef}
            tabIndex={-1}
            role="img"
            aria-label={t("canvasLabel")}
            className="block aspect-[760/600] w-full bg-bg outline-none"
          />

          {(state.phase === "connecting" ||
            state.phase === "lobby" ||
            state.phase === "disconnected") && (
            <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-bg/70 p-3 backdrop-blur-[2px]">
              {state.phase === "connecting" && (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="font-display text-2xl tracking-tight">{t("connecting")}</p>
                  {showColdStartHint && (
                    <p className="max-w-xs text-sm text-muted">{t("coldStartHint")}</p>
                  )}
                </div>
              )}
              {state.phase === "lobby" && (
                <div className="flex w-full max-w-xs flex-col items-center gap-4">
                  <ul className="w-full space-y-1.5 text-sm">
                    {state.participants.map((p) => (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between rounded-lg px-3 py-1.5 ring-1 ring-line ${
                          p.id === state.playerId ? "bg-bg text-accent" : ""
                        }`}
                      >
                        <span>
                          {p.id === state.playerId ? tPlay("you") : tPlay("bot", { n: p.number })}
                        </span>
                        <span className="flex gap-1.5 text-xs text-muted">
                          {p.isBot && <span>{t("botBadge")}</span>}
                          {p.id === state.leaderId && (
                            <span className="text-accent">{t("leaderBadge")}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-center text-sm text-muted">
                    {leading ? t("youAreLeader") : t("waitingForLeader")}
                  </p>
                  {leading && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => send({ event: "add-bot" })}
                          className="btn btn-ghost text-sm"
                        >
                          {t("addBot")}
                        </button>
                        <button
                          type="button"
                          onClick={() => send({ event: "remove-bot" })}
                          className="btn btn-ghost text-sm"
                        >
                          {t("removeBot")}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => send({ event: "start" })}
                        disabled={totalParticipants < 2}
                        className="btn btn-primary disabled:opacity-40"
                      >
                        {tPlay("start")}
                      </button>
                      {totalParticipants < 2 && (
                        <p className="text-xs text-muted">{t("needTwoPlayers")}</p>
                      )}
                    </div>
                  )}
                  {transientError && <p className="text-xs text-accent">{t("actionFailed")}</p>}
                </div>
              )}
              {state.phase === "disconnected" && (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="font-display text-2xl tracking-tight">{t("disconnected")}</p>
                  <button type="button" onClick={reconnect} className="btn btn-primary">
                    {t("reconnect")}
                  </button>
                </div>
              )}
            </div>
          )}

          {state.phase === "racing" && me?.finishedAt !== null && me !== undefined && (
            <p
              role="status"
              className="pointer-events-none absolute inset-x-0 top-3 flex justify-center"
            >
              <span className="rounded-full bg-bg/90 px-4 py-1.5 text-sm text-ink ring-1 ring-line">
                {tPlay("done")}
              </span>
            </p>
          )}

          {state.phase === "finished" && (
            <div className="race-fade-in absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/70 p-4 text-center backdrop-blur-[2px]">
              <p className="font-display text-3xl tracking-tight">{tPlay("standings")}</p>
              <table className="w-full max-w-xs text-left text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-muted">
                    <th scope="col" className="pb-1 font-normal">
                      {tPlay("driver")}
                    </th>
                    <th scope="col" className="pb-1 text-right font-normal">
                      {tPlay("time")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.standings?.map((s, i) => (
                    <tr
                      key={s.carId}
                      className={s.carId === state.playerId ? "text-accent" : undefined}
                    >
                      <th scope="row" className="py-0.5 pr-3 font-normal whitespace-nowrap">
                        {i + 1}.{" "}
                        {s.carId === state.playerId ? tPlay("you") : tPlay("bot", { n: s.number })}
                      </th>
                      <td className="py-0.5 text-right">
                        {s.finishedAt !== null ? formatTime(s.finishedAt) : tPlay("notFinished")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={reconnect} className="btn btn-primary mt-2">
                {t("playAgain")}
              </button>
            </div>
          )}
        </div>

        {/* Touch controls, only while racing. */}
        <div
          className={`mt-4 flex select-none items-center justify-between gap-3 lg:hidden ${
            state.phase === "racing" ? "" : "hidden"
          }`}
        >
          <div className="flex gap-3">
            <TouchButton
              label={tPlay("left")}
              onDown={() => press("left", true)}
              onUp={() => press("left", false)}
            >
              ←
            </TouchButton>
            <TouchButton
              label={tPlay("right")}
              onDown={() => press("right", true)}
              onUp={() => press("right", false)}
            >
              →
            </TouchButton>
          </div>
          <div className="flex gap-3">
            <TouchButton
              label={tPlay("nitroButton")}
              onDown={() => press("nitro", true)}
              onUp={() => press("nitro", false)}
            >
              <BoltIcon className="mx-auto size-5 text-accent" />
            </TouchButton>
            <TouchButton
              label={tPlay("brake")}
              onDown={() => press("down", true)}
              onUp={() => press("down", false)}
            >
              ↓
            </TouchButton>
            <TouchButton
              label={tPlay("gas")}
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
