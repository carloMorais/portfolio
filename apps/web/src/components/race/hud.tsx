"use client";

import type { CSSProperties, ReactNode, Ref } from "react";
import { useTranslations } from "next-intl";
import { TICK_RATE, type Keys } from "race-engine";
import { CAR_COLORS, COLORS, MEDAL_COLORS, type CarColorId } from "./colors";
import { MEDALS, medalFor, type MedalId } from "./ghost";
import { BoltIcon } from "./icons";
import { TouchButton } from "./TouchControls";
import { DIFFICULTIES, formatGap, formatTime, type Difficulty, type ResultRow } from "./session";
import type { Driver, Hud } from "./view";

/**
 * The race's HUD, shared by practice and online mode: standings, lap panel,
 * start lights, banners, the finishing veil, results and touch controls.
 */

/**
 * Standings, track, lap panel: three columns on lg, the track under the panels
 * below it. On lg the three hug each other and sit centred as one block (the
 * track column is never wider than the window's height allows), so the panels
 * belong to the track instead of drifting to the window's edges.
 */
export const RACE_GRID =
  "grid scroll-mt-20 grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-4 lg:grid-cols-[11.5rem_minmax(0,calc((100svh-6rem)*760/600))_8rem] lg:justify-center lg:gap-x-8";
/** Never taller than the window: the whole track stays in view while you drive. */
export const TRACK_COLUMN =
  "col-span-2 row-start-2 mx-auto w-full max-w-[calc((100svh-6rem)*760/600)] lg:col-span-1 lg:col-start-2 lg:row-start-1";
/** The standings and lap panels: small cards that sit against the track, not loose text on the page. */
const PANEL = "self-start rounded-2xl bg-surface p-3 ring-1 ring-line";
type CarColor = (typeof CAR_COLORS)[number];

/**
 * A driver's name in their car's colour: a text shade of the same hue that
 * reads on the site's surfaces, the lighter one in dark mode.
 */
export const CAR_TEXT = "text-(--car-text) dark:text-(--car-text-dark)";
export const carText = (c: CarColor) =>
  ({ "--car-text": c.text, "--car-text-dark": c.textDark }) as CSSProperties;

export const VEIL =
  "absolute inset-0 flex items-center justify-center overflow-y-auto bg-bg/70 p-3 backdrop-blur-[2px]";

type T = ReturnType<typeof useTranslations<"Play">>;

export type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  color: string;
  rotate: number;
};

/** A one-off handful of confetti pieces, randomised once when you take 1st. */
export const makeConfetti = (colors: string[]): ConfettiPiece[] =>
  Array.from({ length: 22 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    color: colors[i % colors.length]!,
    rotate: Math.round(Math.random() * 360),
  }));

/**
 * The standings and the lap panel only show while a race is on screen: before
 * it they'd be an empty table and "—" records. On phones the one-line
 * `CompactHud` takes their place, so both are lg-only.
 */
export function StandingsBoard({
  board,
  me,
  name,
  color,
  t,
}: {
  board: Driver[];
  me: string | null;
  name: (id: string) => string;
  /** Each car's colour: the names are written in it, so you can tell who's who on the track. */
  color: (id: string) => CarColor;
  t: T;
}) {
  return (
    <div className={`${PANEL} col-start-1 row-start-1 max-lg:hidden`}>
      <table className="w-full text-sm tabular-nums">
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
          {board.map((d, i) => (
            <tr key={d.id} className="border-b border-line last:border-0">
              <td className="py-2 pr-3 text-muted">{i + 1}</td>
              <th
                scope="row"
                className={`py-2 pr-3 text-left whitespace-nowrap ${CAR_TEXT} ${d.id === me ? "font-semibold" : "font-normal"}`}
                style={carText(color(d.id))}
              >
                <span className="inline-flex items-center gap-1.5">
                  {name(d.id)}
                  {d.change && (
                    <ChangeIcon
                      dir={d.change}
                      label={t(d.change === "up" ? "gainedPlace" : "lostPlace")}
                    />
                  )}
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
    </div>
  );
}

export function LapPanel({
  hud,
  laps,
  best,
  t,
}: {
  hud: Hud;
  laps: number;
  best: { race: number | null; lap: number | null };
  t: T;
}) {
  const fastestLap = hud.laps.length > 0 ? Math.min(...hud.laps) : null;
  return (
    <dl
      className={`${PANEL} col-start-2 row-start-1 flex flex-col gap-4 tabular-nums max-lg:hidden lg:col-start-3`}
    >
      <LiveTimes hud={hud} laps={laps} fastestLap={fastestLap} t={t} />
      <div className="border-t border-line pt-3 text-sm">
        <dt className="text-xs text-muted">{t("record")}</dt>
        <dd>{best.race !== null ? formatTime(best.race) : "—"}</dd>
        <dt className="mt-2 text-xs text-muted">{t("bestLap")}</dt>
        <dd>{best.lap !== null ? formatTime(best.lap) : "—"}</dd>
      </div>
    </dl>
  );
}

/** Lap, time, sector delta and lap times: the lap panel while a race is on. */
function LiveTimes({
  hud,
  laps,
  fastestLap,
  t,
}: {
  hud: Hud;
  laps: number;
  fastestLap: number | null;
  t: T;
}) {
  return (
    <>
      <div>
        <dt className="text-xs text-muted">{t("lap")}</dt>
        <dd className="font-display text-3xl tracking-tight">
          {hud.lap}
          <span className="text-muted">/{laps}</span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">{t("time")}</dt>
        <dd className="font-display text-3xl tracking-tight">{formatTime(hud.time)}</dd>
      </div>
      {hud.delta !== null && (
        <div>
          <dt className="text-xs text-muted">{t("delta")}</dt>
          <dd
            className={`font-display text-xl tracking-tight tabular-nums ${hud.delta <= 0 ? "text-accent" : "text-ink"}`}
          >
            {hud.delta <= 0 ? "−" : "+"}
            {Math.abs(hud.delta / TICK_RATE).toFixed(1)}
          </dd>
        </div>
      )}
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
    </>
  );
}

/** Confetti, the start lights, lights out and the banners: everything over the running race. */
export function TrackOverlays({
  hud,
  countdown,
  racing,
  showLastLap,
  confetti,
  t,
}: {
  hud: Hud;
  countdown: boolean;
  /** Racing or finishing: the wrong-way warning applies. */
  racing: boolean;
  showLastLap: boolean;
  confetti: ConfettiPiece[] | null;
  t: T;
}) {
  return (
    <>
      {confetti && (
        <div className="race-confetti" aria-hidden>
          {confetti.map((piece) => (
            <span
              key={piece.id}
              style={{
                left: `${piece.left}%`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                transform: `rotate(${piece.rotate}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* The race stays fully visible; only the lights overlay it, zoomed in and large. */}
      {countdown && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div
            className="race-lights-zoom flex gap-3 rounded-2xl px-6 py-5 ring-1 ring-white/10"
            style={{ backgroundColor: COLORS.rig }}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="size-6 rounded-full sm:size-7"
                style={{
                  backgroundColor: i < hud.lit ? COLORS.lightOn : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
          <p className="race-pop-in rounded-full bg-bg/90 px-4 py-1.5 text-sm text-ink ring-1 ring-line">
            {t("lightsHint")}
          </p>
        </div>
      )}

      {/* Lights out: the same rig flashes and zooms away as the race starts. */}
      {hud.justStarted && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="race-lights-out flex gap-3 rounded-2xl px-6 py-5"
            style={{ backgroundColor: COLORS.rig }}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="size-6 rounded-full sm:size-7"
                style={{ backgroundColor: COLORS.lightOn }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Banners over the race, never blocking it. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-3">
        {hud.wrongWay && racing && (
          <p role="status" className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-bg">
            {t("wrongWay")}
          </p>
        )}
        {hud.lastLap && showLastLap && (
          <p className="race-pop-in font-display text-3xl tracking-tight text-accent drop-shadow-[0_1px_0_var(--bg)]">
            {t("lastLap")}
          </p>
        )}
        {hud.justStarted && (
          <p className="race-pop-in font-display text-3xl tracking-tight text-accent drop-shadow-[0_1px_0_var(--bg)]">
            {t("go")}
          </p>
        )}
        {/* Sitting still after the start: say how to drive (keys on desktop, the button on phones). */}
        {hud.idle && racing && !hud.justStarted && (
          <p
            role="status"
            className="race-pop-in rounded-full bg-bg/90 px-4 py-1.5 text-sm text-ink ring-1 ring-line"
          >
            <span className="lg:hidden">{t("idleHint")}</span>
            <span className="max-lg:hidden">{t("idleHintKeys")}</span>
          </p>
        )}
      </div>
    </>
  );
}

/** You're done: a soft veil, the race still visible behind it; the texts bounce in one by one. */
export function FinishingVeil({ place, onSkip, t }: { place: number; onSkip: () => void; t: T }) {
  return (
    <div
      role="status"
      className="race-fade-in pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/60 p-4 text-center"
    >
      <p className="race-elastic-in font-display text-4xl tracking-tight sm:text-6xl">
        {t("finished", { n: place })}
      </p>
      <p
        className="race-elastic-in text-sm text-muted motion-safe:animate-pulse sm:text-base"
        style={{ animationDelay: "0.12s" }}
      >
        {t("waiting")}
      </p>
      <button
        type="button"
        onClick={onSkip}
        className="race-fade-in pointer-events-auto mt-2 text-xs text-muted underline underline-offset-4 hover:text-ink"
        style={{ animationDelay: "0.3s" }}
      >
        {t("skip")}
      </button>
    </div>
  );
}

const ROUND_BUTTON =
  "grid size-8 cursor-pointer place-items-center rounded-full bg-bg/85 text-muted ring-1 ring-line transition-colors hover:text-ink";

/** The small buttons over the track's top-left corner (pause, sound), out of the way of the banners. */
export function TrackButtons({
  children,
  phoneHidden = false,
}: {
  children: ReactNode;
  /** Phones: the start card covers nearly all the track, so the buttons wait for the race. */
  phoneHidden?: boolean;
}) {
  return (
    <div
      className={`absolute top-2.5 left-2.5 z-10 flex gap-2 ${phoneHidden ? "max-lg:hidden" : ""}`}
    >
      {children}
    </div>
  );
}

/** Sound on or off (off by default; remembered). */
export function SoundButton({ on, onToggle, t }: { on: boolean; onToggle: () => void; t: T }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t("soundOff") : t("soundOn")}
      title={on ? t("soundOff") : t("soundOn")}
      onClick={onToggle}
      className={ROUND_BUTTON}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none" stroke="currentColor">
        <path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" fill="currentColor" stroke="none" />
        {on ? (
          <path
            d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6 6 0 0 1 0 8.8"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        ) : (
          <path d="M11 6l3.5 4M14.5 6L11 10" strokeWidth="1.4" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

/** Pause, any time (inside `TrackButtons`). */
export function PauseButton({ onClick, t }: { onClick: () => void; t: T }) {
  return (
    <button type="button" aria-label={t("pause")} onClick={onClick} className={ROUND_BUTTON}>
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
        <rect x="2.5" y="2" width="2.5" height="8" rx="1" fill="currentColor" />
        <rect x="7" y="2" width="2.5" height="8" rx="1" fill="currentColor" />
      </svg>
    </button>
  );
}

/** Final results: your place and time, a new record if any, everyone's time or gap and best lap. */
export function ResultsCard({
  rows,
  me,
  place,
  myTime,
  outcome,
  name,
  color,
  t,
  header,
  children,
  extra,
}: {
  rows: ResultRow[];
  me: string;
  place: number;
  myTime: number | null;
  outcome: { newRace: boolean; newLap: boolean } | null;
  name: (id: string) => string;
  /** Each car's colour, for the names (as in the standings). */
  color: (id: string) => CarColor;
  t: T;
  /** On top of the card: the mode switch, so you can change modes after a race. */
  header?: ReactNode;
  /** The actions under the table (race again, difficulty…). */
  children: ReactNode;
  /** Under the time (time trial: the medal won, or how far the next one was). */
  extra?: ReactNode;
}) {
  return (
    <div className="race-fade-in my-auto w-full max-w-sm rounded-2xl bg-bg p-4 text-center ring-1 ring-line sm:p-6">
      {header && <div className="mb-5 flex justify-center">{header}</div>}
      <p className="race-elastic-in font-display text-2xl tracking-tight sm:text-3xl">
        {place > 0 ? t("finished", { n: place }) : t("standings")}
      </p>
      {myTime !== null && (
        <p
          className="race-elastic-in mt-1 text-sm text-muted tabular-nums"
          style={{ animationDelay: "0.1s" }}
        >
          {t("finishedTime", { time: formatTime(myTime) })}
        </p>
      )}
      {extra && (
        <div className="race-elastic-in mt-3" style={{ animationDelay: "0.15s" }}>
          {extra}
        </div>
      )}
      {(outcome?.newRace || outcome?.newLap) && (
        <p className="race-elastic-in mt-2 text-sm text-accent" style={{ animationDelay: "0.2s" }}>
          {outcome.newRace ? t("newRecord") : t("newBestLap")}
        </p>
      )}
      <table
        className="race-elastic-in mt-4 w-full text-left text-xs tabular-nums sm:text-sm"
        style={{ animationDelay: "0.3s" }}
      >
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
            <tr key={row.id} className={row.id === me ? "font-semibold" : undefined}>
              <th
                scope="row"
                className={`py-0.5 pr-3 whitespace-nowrap ${CAR_TEXT} ${row.id === me ? "font-semibold" : "font-normal"}`}
                style={carText(color(row.id))}
              >
                {i + 1}. {name(row.id)}
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
      <div
        className="race-fade-in mt-5 flex flex-col items-center gap-4"
        style={{ animationDelay: "0.45s" }}
      >
        {children}
      </div>
    </div>
  );
}

export function RestartButton({
  onClick,
  label,
  hint,
  buttonRef,
}: {
  onClick: () => void;
  label: string;
  hint: string;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <>
      <button ref={buttonRef} type="button" onClick={onClick} className="btn btn-primary">
        {label}
      </button>
      <p className="hidden text-xs text-muted lg:block">{hint}</p>
    </>
  );
}

/** Touch controls below lg (phones and tablets; pointer media queries aren't reliable). */
export function TouchPad({
  press,
  hidden,
  autoGas,
  onAutoGas,
  t,
}: {
  press: (key: keyof Keys, down: boolean) => void;
  hidden: boolean;
  /** The throttle is held for you: no accelerator button, steering is all you do. */
  autoGas: boolean;
  onAutoGas: (on: boolean) => void;
  t: T;
}) {
  return (
    <div className={`lg:hidden ${hidden ? "hidden" : ""}`}>
      <div className="mt-4 flex select-none items-center justify-between gap-3">
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
          {!autoGas && (
            <TouchButton
              label={t("gas")}
              primary
              onDown={() => press("up", true)}
              onUp={() => press("up", false)}
            >
              ↑
            </TouchButton>
          )}
        </div>
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={autoGas}
          onChange={(e) => onAutoGas(e.target.checked)}
          className="size-4 cursor-pointer accent-(--accent)"
        />
        {t("autoGas")}
      </label>
    </div>
  );
}

export function DifficultyPicker({
  value,
  onChange,
  t,
}: {
  value: Difficulty;
  /** Without it the picker only shows the choice (online, when you're not the leader). */
  onChange?: (d: Difficulty) => void;
  t: T;
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
            disabled={!onChange}
            onClick={() => onChange?.(d)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              value === d ? "bg-ink text-bg" : "text-muted enabled:hover:text-ink"
            }`}
          >
            {t(d)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Nitro charges as bolts, only the ones you hold: empty slots drawn faintly
 * read as a rendering glitch, not as "no nitro".
 */
function Nitro({ count, label }: { count: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex min-h-3 gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <BoltIcon key={i} className="size-3 text-accent" />
      ))}
    </span>
  );
}

/**
 * Below lg, while racing: place, lap and time on one line above the track, in
 * place of the two panels, so the track and the touch controls fit the screen.
 */
export function CompactHud({
  hud,
  me,
  laps,
  showPlace = true,
  t,
}: {
  hud: Hud;
  me: string | null;
  laps: number;
  /** Time trial races alone: no place to show. */
  showPlace?: boolean;
  t: T;
}) {
  const place = hud.board.findIndex((d) => d.id === me) + 1;
  return (
    <p className="mb-2 flex items-baseline justify-between gap-3 text-sm text-muted tabular-nums lg:hidden">
      {showPlace && (
        <span>
          {t("place")} <span className="font-display text-xl text-ink">{place || "–"}</span>/
          {hud.board.length}
        </span>
      )}
      <span>
        {t("lap")} <span className="font-display text-xl text-ink">{hud.lap}</span>/{laps}
      </span>
      <span className="font-display text-xl text-ink">{formatTime(hud.time)}</span>
    </p>
  );
}

export type RaceMode = "training" | "trial" | "online";
/** Left to right, as in the switch (the card slides in from the side you head to). */
export const RACE_MODES: RaceMode[] = ["training", "trial", "online"];
/** Which side a mode's card slides in from (null: no animation, e.g. on page load). */
export type SlideFrom = "left" | "right" | null;

/** Practice, time trial or online: the switch on top of the race's card. */
export function ModeSwitch({
  mode,
  onChange,
  disabled = false,
  t,
}: {
  mode: RaceMode;
  onChange: (mode: RaceMode) => void;
  /** While online mode connects, the switch waits too. */
  disabled?: boolean;
  t: ReturnType<typeof useTranslations<"Online">>;
}) {
  return (
    <div
      role="group"
      aria-label={`${t("modeTraining")} / ${t("modeTrial")} / ${t("modeOnline")}`}
      className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line"
    >
      {RACE_MODES.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          disabled={disabled}
          onClick={() => onChange(m)}
          className={`cursor-pointer rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors disabled:cursor-wait sm:px-4 ${
            mode === m ? "bg-ink text-bg" : "text-muted enabled:hover:text-ink disabled:opacity-60"
          }`}
        >
          {m === "training" ? t("modeTraining") : m === "trial" ? t("modeTrial") : t("modeOnline")}
        </button>
      ))}
    </div>
  );
}

/**
 * The window over the blurred track outside a race: the mode switch on top,
 * then that mode's content, which slides in sideways when the mode changes
 * (from the right towards Online, from the left back to Practice). Centred
 * on the track both ways.
 */
export function StartCard({
  header,
  slideFrom = null,
  children,
}: {
  header?: ReactNode;
  slideFrom?: SlideFrom;
  children: ReactNode;
}) {
  const slide =
    slideFrom === "right"
      ? "race-slide-from-right"
      : slideFrom === "left"
        ? "race-slide-from-left"
        : "";
  return (
    <div className="my-auto flex w-full max-w-xl flex-col items-center gap-4 overflow-hidden rounded-2xl bg-bg p-5 text-center shadow-sm ring-1 ring-line">
      {header}
      <div className={`flex w-full flex-col items-center gap-4 ${slide}`}>{children}</div>
    </div>
  );
}

/**
 * Your car's colour: one swatch per colour. `taken` ones (another player's,
 * online) can't be picked; a bot's can (online, the bot takes yours instead).
 */
export function ColorPicker({
  value,
  onChange,
  taken = [],
  disabled = false,
  t,
}: {
  value: number;
  onChange: (color: number) => void;
  taken?: number[];
  disabled?: boolean;
  t: T;
}) {
  const label = (id: CarColorId) => t(`colors.${id}`);
  return (
    <div role="group" aria-label={t("carColor")} className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted">{t("carColor")}</span>
      <div className="flex flex-wrap justify-center gap-1.5">
        {CAR_COLORS.map((c, i) => {
          const isTaken = taken.includes(i) && i !== value;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={value === i}
              aria-label={isTaken ? t("colorTaken", { color: label(c.id) }) : label(c.id)}
              title={isTaken ? t("colorTaken", { color: label(c.id) }) : label(c.id)}
              disabled={disabled || isTaken}
              onClick={() => onChange(i)}
              className={`size-6 cursor-pointer rounded-full ring-offset-2 sm:size-7 ring-offset-bg transition-transform enabled:hover:scale-110 disabled:cursor-not-allowed disabled:opacity-25 ${
                value === i ? "ring-2 ring-ink" : "ring-1 ring-black/15"
              }`}
              style={{ backgroundColor: c.body }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** A small turning ring, for "connecting" (still with reduced motion). */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-5 rounded-full border-2 border-line border-t-accent motion-safe:animate-spin ${className}`}
    />
  );
}

/** A medal as a small coloured disc with a ribbon notch. */
export function MedalIcon({ id, className = "size-4" }: { id: MedalId; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M5 1h2.5l1 4H6zM8.5 1H11L10 5H7.5z" fill={MEDAL_COLORS[id]} opacity="0.6" />
      <circle cx="8" cy="10" r="5" fill={MEDAL_COLORS[id]} />
      <circle cx="8" cy="10" r="3" fill="none" stroke="#ffffff" strokeOpacity="0.55" />
    </svg>
  );
}

/**
 * Time trial's targets: the three medal times, the ones your record already
 * earned ticked, and your record under them.
 */
export function MedalTargets({
  record,
  t,
  className = "",
}: {
  record: number | null;
  t: T;
  className?: string;
}) {
  const earned = medalFor(record);
  const rank = (id: MedalId) => MEDALS.findIndex((m) => m.id === id);
  return (
    <div className={`text-sm tabular-nums ${className}`}>
      <p className="mb-2 text-xs text-muted">{t("medals")}</p>
      <ul className="space-y-1.5">
        {MEDALS.map((m) => {
          const got = earned !== null && rank(earned) <= rank(m.id);
          return (
            <li key={m.id} className="flex items-center gap-2">
              <MedalIcon id={m.id} className={`size-4 ${got ? "" : "opacity-40 grayscale"}`} />
              <span className={got ? "text-ink" : "text-muted"}>{t(m.id)}</span>
              <span className="ml-auto text-muted">{formatTime(m.ticks)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex justify-between border-t border-line pt-2 text-xs text-muted">
        {t("trialRecord")}
        <span className="text-ink">{record !== null ? formatTime(record) : "—"}</span>
      </p>
    </div>
  );
}

/** Time trial, beside the track during a run: the medal targets in a panel. */
export function MedalPanel({ record, t }: { record: number | null; t: T }) {
  return (
    <div className={`${PANEL} col-start-1 row-start-1 max-lg:hidden`}>
      <MedalTargets record={record} t={t} />
    </div>
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

/** A small arrow for a place just gained (up, accent) or lost (down, muted). */
function ChangeIcon({ dir, label }: { dir: "up" | "down"; label: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 10 10"
      className={`size-2.5 ${dir === "up" ? "text-accent" : "text-muted"}`}
    >
      <path d={dir === "up" ? "M5 1 9 7H1Z" : "M5 9 1 3H9Z"} fill="currentColor" />
    </svg>
  );
}
