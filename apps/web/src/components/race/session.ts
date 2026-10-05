import {
  BOT_STYLES,
  DIFFICULTIES,
  TICK_RATE,
  type BotStyle,
  type Car,
  type Difficulty,
} from "race-engine";

export const PLAYER = "you";
export const LAPS = 2;

export { DIFFICULTIES, type Difficulty };

/** The three practice bots for each difficulty (styles shared with the online server). */
export const BOTS: Record<Difficulty, { id: string; style: BotStyle }[]> = Object.fromEntries(
  DIFFICULTIES.map((d) => [d, BOT_STYLES[d].map((style, i) => ({ id: `bot${i + 2}`, style }))]),
) as Record<Difficulty, { id: string; style: BotStyle }[]>;

/** This browser's localStorage, or undefined where it's blocked. */
export const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** 0:27.4 */
export const formatTime = (ticks: number) => {
  const s = ticks / TICK_RATE;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

/** +1.4 s behind */
export const formatGap = (ticks: number) => `+${(ticks / TICK_RATE).toFixed(1)}`;

export const bestLap = (car: Pick<Car, "lapTicks">) =>
  car.lapTicks.length > 0 ? Math.min(...car.lapTicks) : null;

export type ResultRow = {
  id: string;
  /** Total time for the winner, the gap to them for everyone else; null if still racing. */
  time: { kind: "total" | "gap"; ticks: number } | null;
  bestLap: number | null;
};

/** Results in race order (`ordered` comes from `standings`). */
export function resultRows(ordered: Car[]): ResultRow[] {
  const winner = ordered[0]?.finishedAt ?? null;
  return ordered.map((car, i) => ({
    id: car.id,
    time:
      car.finishedAt === null || winner === null
        ? null
        : i === 0
          ? { kind: "total", ticks: car.finishedAt }
          : { kind: "gap", ticks: car.finishedAt - winner },
    bestLap: bestLap(car),
  }));
}

/**
 * Your best race and best lap for a difficulty, in ticks. `splits` are the
 * ticks-since-lap-start at each checkpoint of that best lap, the reference
 * the live delta compares against (null until a lap has been timed).
 */
export type PersonalBest = { race: number | null; lap: number | null; splits: number[] | null };

/** Practice records are per difficulty; online races share one record. */
export type RecordKey = Difficulty | "online";

const storageKey = (d: RecordKey) => `racegame:best:${d}`;
const EMPTY_BEST: PersonalBest = { race: null, lap: null, splits: null };

/** Read from this browser only; any storage error means no record yet. */
export function loadBest(storage: Storage | undefined, d: RecordKey): PersonalBest {
  try {
    const raw = storage?.getItem(storageKey(d));
    const parsed = raw ? (JSON.parse(raw) as Partial<PersonalBest>) : {};
    const ticks = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);
    const splits =
      Array.isArray(parsed.splits) && parsed.splits.every((n) => typeof n === "number");
    return {
      race: ticks(parsed.race),
      lap: ticks(parsed.lap),
      splits: splits ? parsed.splits! : null,
    };
  } catch {
    return { ...EMPTY_BEST };
  }
}

/**
 * Folds a finished race into the record. `lapSplits` are this race's own
 * best lap's checkpoint splits, kept only when that lap is a new record.
 * Returns the new record and which parts of it this race beat.
 */
export function updateBest(
  best: PersonalBest,
  race: number,
  lap: number | null,
  lapSplits: number[] | null = null,
): { best: PersonalBest; newRace: boolean; newLap: boolean } {
  const newRace = best.race === null || race < best.race;
  const newLap = lap !== null && (best.lap === null || lap < best.lap);
  return {
    best: {
      race: newRace ? race : best.race,
      lap: newLap ? lap : best.lap,
      splits: newLap ? lapSplits : best.splits,
    },
    newRace,
    newLap,
  };
}

export function saveBest(storage: Storage | undefined, d: RecordKey, best: PersonalBest) {
  try {
    storage?.setItem(storageKey(d), JSON.stringify(best));
  } catch {
    // Private mode or storage blocked: the record just doesn't persist.
  }
}

export function loadDifficulty(storage: Storage | undefined): Difficulty {
  try {
    const d = storage?.getItem("racegame:difficulty");
    return DIFFICULTIES.find((x) => x === d) ?? "normal";
  } catch {
    return "normal";
  }
}

export function saveDifficulty(storage: Storage | undefined, d: Difficulty) {
  try {
    storage?.setItem("racegame:difficulty", d);
  } catch {
    // Not persisted; the choice still applies to this visit.
  }
}

/** Ticks of driving the wrong way before we say so (a bounce flips the velocity for a moment). */
export const WRONG_WAY_TICKS = 20;
/** How long the wrong-way warning stays after bouncing off an out-of-order checkpoint. */
export const GATE_WARNING_TICKS = 45;
