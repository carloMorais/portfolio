import { NO_KEYS, TICK_RATE, type Keys } from "race-engine";

/**
 * Time trial's ghost: your best run, replayed. The engine is deterministic
 * (`stepRace` is pure), so a run is just the keys you held at each tick: run
 * them again from the grid and the car drives exactly the same line. No
 * positions are stored, and nothing leaves the browser.
 *
 * One character per tick (5 bits: up, down, left, right, nitro), so two laps
 * (~1,500 ticks) take ~1.5 KB of localStorage.
 */

const ORDER: (keyof Keys)[] = ["up", "down", "left", "right", "nitro"];
const BASE = 65; // "A": every 5-bit value maps to a printable character (A…`)

export const encodeKeys = (k: Keys) =>
  String.fromCharCode(BASE + ORDER.reduce((bits, key, i) => bits | (k[key] ? 1 << i : 0), 0));

export function decodeKeys(ch: string | undefined): Keys {
  if (!ch) return NO_KEYS;
  const bits = ch.charCodeAt(0) - BASE;
  return Object.fromEntries(ORDER.map((key, i) => [key, (bits & (1 << i)) !== 0])) as Keys;
}

/**
 * Bump this whenever the physics or the track change: an old ghost would no
 * longer follow the line it was recorded on, so it's dropped instead.
 * (2: obstacle penalty by kind and nitros moved, 05/10/2026.)
 */
export const GHOST_VERSION = 2;
const KEY = "racegame:ghost";

export type Ghost = { v: number; ticks: number; keys: string };

export function loadGhost(storage: Storage | undefined): Ghost | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Partial<Ghost>;
    return g.v === GHOST_VERSION && typeof g.ticks === "number" && typeof g.keys === "string"
      ? (g as Ghost)
      : null;
  } catch {
    return null;
  }
}

export function saveGhost(storage: Storage | undefined, ghost: Ghost) {
  try {
    storage?.setItem(KEY, JSON.stringify(ghost));
  } catch {
    // Storage full or blocked: the ghost just isn't kept.
  }
}

export type MedalId = "gold" | "silver" | "bronze";

/**
 * Two-lap times for each medal, best first, set against the bots (05/10/2026,
 * see BOT_STYLES): gold keeps up with the hard bots (~42–49 s), bronze beats
 * the normal ones on average (~56 s), silver sits in between. They were 50,
 * 55 and 62 s while the hard bots did ~52 s.
 */
export const MEDALS: { id: MedalId; ticks: number }[] = [
  { id: "gold", ticks: 44 * TICK_RATE },
  { id: "silver", ticks: 49 * TICK_RATE },
  { id: "bronze", ticks: 56 * TICK_RATE },
];

/** The best medal a time earns, or null. */
export const medalFor = (ticks: number | null): MedalId | null =>
  ticks === null ? null : (MEDALS.find((m) => ticks <= m.ticks)?.id ?? null);

/** The closest medal still out of reach, and by how many ticks; null with gold. */
export function nextMedal(ticks: number): { id: MedalId; missedBy: number } | null {
  const missed = MEDALS.filter((m) => ticks > m.ticks).at(-1);
  return missed ? { id: missed.id, missedBy: ticks - missed.ticks } : null;
}
