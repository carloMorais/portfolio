import {
  BOT_STYLES,
  DIFFICULTIES,
  activeItems,
  botKeys,
  classicTrack,
  createRace,
  NO_KEYS,
  standings,
  stepRace,
  TICK_RATE,
  type Car,
  type Difficulty,
  type Keys,
  type RaceState,
} from "race-engine/node";
import type { CarSnapshot, ServerMessage } from "./protocol";

/** Anything the room can send a message to; `ws.WebSocket` satisfies this, so do test doubles. */
export type RoomClient = { send(data: string): void };

const LAPS = 2;
const CAPACITY = 10;
/** Safety net so an abandoned room doesn't tick forever: 2 laps rarely take this long. */
const MAX_TICKS = TICK_RATE * 150;
/** The leader can't start alone: a lone human racing bots felt like practice mode, not online. */
const MIN_PARTICIPANTS = 2;
/** The start lights, as long as practice mode's. */
export const COUNTDOWN_MS = 3000;
/** Once every human is done (finished or gone), the bots get this long to finish, as in practice. */
const WAIT_TICKS = TICK_RATE * 45;

type Player = { carId: string; number: number };
type ActionResult = { ok: true } | { ok: false; message: string };
type RoomOptions = { countdownMs?: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

const snapshot = (c: Car): CarSnapshot => ({
  id: c.id,
  x: round2(c.x),
  y: round2(c.y),
  rotation: round2(c.rotation),
  vx: round2(c.vx),
  vy: round2(c.vy),
  checkpoint: c.checkpoint,
  waypoint: c.waypoint,
  laps: c.laps,
  nitro: c.nitro,
  nitroUntil: c.nitroUntil,
  finishedAt: c.finishedAt,
  lapTicks: c.lapTicks,
});

/**
 * One race room: the first player in is the leader, who adds/removes bots,
 * picks how they drive and decides when to start (never a timer) — then the
 * start lights run, and the room runs the authoritative simulation at
 * `TICK_RATE` and broadcasts every tick.
 *
 * Each racer (human or bot) only gets a sequential number, never a name
 * string: the site is bilingual, and "Piloto N"/"Driver N" has to be worded
 * by the client in the viewer's own language, not hardcoded here.
 */
export class Room {
  readonly id: string;
  state: "waiting" | "countdown" | "racing" | "done" = "waiting";

  private readonly players = new Map<RoomClient, Player>();
  /** Join order, oldest first: index 0 is the leader. */
  private readonly playerOrder: RoomClient[] = [];
  /** Bots in the order they were added, so "remove" takes the most recent one. */
  private readonly botOrder: string[] = [];
  private readonly numbers = new Map<string, number>();
  private readonly keys = new Map<string, Keys>();
  private nextNumber = 1;
  /** Chosen by the leader; sets the bots' styles (the same three as practice mode's). */
  private difficulty: Difficulty = "normal";
  private humanIds: string[] = [];
  /** Tick at which every human was done, for the bots' grace period. */
  private humansDoneAt: number | null = null;
  private raceState: RaceState | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly countdownMs: number;

  constructor(
    id: string,
    private readonly onEmpty: (room: Room) => void,
    private readonly onDone: (room: Room) => void,
    private readonly track = classicTrack,
    options: RoomOptions = {},
  ) {
    this.id = id;
    this.countdownMs = options.countdownMs ?? COUNTDOWN_MS;
  }

  get playerCount() {
    return this.players.size;
  }

  get isFull() {
    return this.players.size + this.botOrder.length >= CAPACITY;
  }

  private get leader(): RoomClient | null {
    return this.playerOrder[0] ?? null;
  }

  private isLeader(client: RoomClient) {
    return this.leader === client;
  }

  /** Assigns a car and a number. The first player in becomes the leader. */
  join(client: RoomClient): Player {
    const number = this.nextNumber++;
    const player: Player = { carId: `p-${this.players.size}-${number}`, number };
    this.players.set(client, player);
    this.playerOrder.push(client);
    this.numbers.set(player.carId, number);
    this.keys.set(player.carId, NO_KEYS);

    this.send(client, {
      type: "welcome",
      playerId: player.carId,
      number: player.number,
      roomId: this.id,
      laps: LAPS,
      tickRate: TICK_RATE,
    });
    this.broadcastLobby();
    return player;
  }

  leave(client: RoomClient) {
    const player = this.players.get(client);
    if (!player) return;
    this.players.delete(client);
    const orderIndex = this.playerOrder.indexOf(client);
    if (orderIndex !== -1) this.playerOrder.splice(orderIndex, 1);
    if (this.state === "waiting") {
      if (this.players.size === 0) {
        this.onEmpty(this);
      } else {
        // Whoever joined next in line takes over (playerOrder[0], unchanged by the splice above).
        this.broadcastLobby();
      }
    } else {
      // The car stays in the race (the engine's car list is fixed once started);
      // it just stops responding and coasts, same as the original.
      this.keys.set(player.carId, NO_KEYS);
      if (this.players.size === 0) this.finish();
    }
  }

  setInput(client: RoomClient, keys: Keys) {
    const player = this.players.get(client);
    // Keys held during the lights count from the first tick, as in practice mode.
    if (!player || (this.state !== "racing" && this.state !== "countdown")) return;
    this.keys.set(player.carId, keys);
  }

  addBot(client: RoomClient): ActionResult {
    if (this.state !== "waiting") return { ok: false, message: "race already started" };
    if (!this.isLeader(client)) return { ok: false, message: "only the leader can add bots" };
    if (this.isFull) return { ok: false, message: "room is full" };
    const number = this.nextNumber++;
    const carId = `b-${this.botOrder.length}-${number}`;
    this.botOrder.push(carId);
    this.numbers.set(carId, number);
    this.broadcastLobby();
    return { ok: true };
  }

  removeBot(client: RoomClient): ActionResult {
    if (this.state !== "waiting") return { ok: false, message: "race already started" };
    if (!this.isLeader(client)) return { ok: false, message: "only the leader can remove bots" };
    const carId = this.botOrder.pop();
    if (!carId) return { ok: false, message: "no bots to remove" };
    this.numbers.delete(carId);
    this.broadcastLobby();
    return { ok: true };
  }

  setDifficulty(client: RoomClient, difficulty: unknown): ActionResult {
    if (this.state !== "waiting") return { ok: false, message: "race already started" };
    if (!this.isLeader(client)) {
      return { ok: false, message: "only the leader can set the difficulty" };
    }
    const d = DIFFICULTIES.find((x) => x === difficulty);
    if (!d) return { ok: false, message: "unknown difficulty" };
    this.difficulty = d;
    this.broadcastLobby();
    return { ok: true };
  }

  startRace(client: RoomClient): ActionResult {
    if (this.state !== "waiting") return { ok: false, message: "race already started" };
    if (!this.isLeader(client)) return { ok: false, message: "only the leader can start the race" };
    const total = this.players.size + this.botOrder.length;
    if (total < MIN_PARTICIPANTS) {
      return { ok: false, message: `need at least ${MIN_PARTICIPANTS} players` };
    }

    this.humanIds = [...this.players.values()].map((p) => p.carId);
    const carIds = [...this.humanIds, ...this.botOrder];
    this.raceState = createRace(this.track, carIds, LAPS);
    this.state = "countdown";

    const numbers = Object.fromEntries(carIds.map((id) => [id, this.numbers.get(id)!]));
    this.broadcast({ type: "start", carIds, numbers, countdownMs: this.countdownMs });

    // unref: a room ticking away doesn't need to keep the process (or a test) alive by itself.
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      this.state = "racing";
      this.tickTimer = setInterval(() => this.tick(), 1000 / TICK_RATE).unref();
    }, this.countdownMs).unref();
    return { ok: true };
  }

  private tick() {
    if (!this.raceState) return;
    const styles = BOT_STYLES[this.difficulty];
    const inputs: Record<string, Keys> = {};
    for (const car of this.raceState.cars) {
      const bot = this.botOrder.indexOf(car.id);
      inputs[car.id] =
        bot === -1
          ? (this.keys.get(car.id) ?? NO_KEYS)
          : botKeys(car, this.track, styles[bot % styles.length]);
    }
    const s = stepRace(this.raceState, this.track, inputs);
    this.raceState = s;

    this.broadcast({
      type: "state",
      tick: s.tick,
      cars: s.cars.map(snapshot),
      items: activeItems(this.track, s).map((it) => it.id),
      finished: s.finished,
      events: s.events,
    });

    // Every human done (finished or gone): the bots get a grace period, as in practice.
    const connected = new Set([...this.players.values()].map((p) => p.carId));
    const humansDone = this.humanIds.every(
      (id) => !connected.has(id) || s.cars.find((c) => c.id === id)?.finishedAt !== null,
    );
    if (humansDone) this.humansDoneAt ??= s.tick;
    const allFinished = s.cars.every((c) => c.finishedAt !== null);
    const graceOver = this.humansDoneAt !== null && s.tick - this.humansDoneAt >= WAIT_TICKS;
    if (allFinished || graceOver || s.tick >= MAX_TICKS) this.finish();
  }

  private finish() {
    if (!this.raceState || this.state === "done") return;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.tickTimer = null;
    this.countdownTimer = null;
    this.state = "done";

    const ranked = standings(this.raceState, this.track);
    this.broadcast({
      type: "finished",
      standings: ranked.map((c) => ({
        carId: c.id,
        number: this.numbers.get(c.id) ?? 0,
        laps: c.laps,
        lapTicks: c.lapTicks,
        finishedAt: c.finishedAt,
      })),
    });
    this.onDone(this);
  }

  private broadcastLobby() {
    const leaderId = this.leader ? this.players.get(this.leader)!.carId : null;
    const participants = [
      ...[...this.players.values()].map((p) => ({ id: p.carId, number: p.number, isBot: false })),
      ...this.botOrder.map((id) => ({ id, number: this.numbers.get(id)!, isBot: true })),
    ];
    this.broadcast({ type: "lobby", participants, leaderId, difficulty: this.difficulty });
  }

  private send(client: RoomClient, message: ServerMessage) {
    client.send(JSON.stringify(message));
  }

  private broadcast(message: ServerMessage) {
    const body = JSON.stringify(message);
    for (const client of this.players.keys()) client.send(body);
  }
}
