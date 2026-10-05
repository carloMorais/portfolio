import {
  BOT_STYLES,
  DIFFICULTIES,
  botKeys,
  classicTrack,
  createRace,
  encodeTick,
  NO_KEYS,
  standings,
  stepRace,
  TICK_RATE,
  type Difficulty,
  type Keys,
  type RaceEvent,
  type RaceState,
} from "race-engine/node";
import { CLOSE_TOO_SLOW, MAX_BUFFERED_BYTES } from "./limits";
import type { ServerMessage } from "./protocol";

/**
 * Anything the room can send a message to; `ws.WebSocket` satisfies this, so
 * do test doubles. `bufferedAmount` and `close` are there for backpressure
 * (see `broadcast`); doubles may leave them out.
 */
export type RoomClient = {
  send(data: string): void;
  bufferedAmount?: number;
  close?(code: number, reason?: string): void;
};

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
const STEP_MS = 1000 / TICK_RATE;
/**
 * The simulation runs at 30 ticks/s, but state goes out every 2nd tick
 * (15 messages/s): half the bandwidth, and clients interpolate between
 * messages anyway (`OnlineRace.tsx`'s jitter buffer), with prediction keeping
 * your own car instant. Events from the skipped tick ride along in the next
 * message, so none is lost.
 */
export const SEND_EVERY = 2;
/**
 * At most this many ticks are run back to back to catch up after the process
 * was late (a GC pause, or CPU throttling on Render's 0.1-CPU plan). Further
 * behind than that, the race slows down instead of fast-forwarding in a burst.
 */
const MAX_CATCH_UP = 5;

type Player = { carId: string; number: number };
/** `code: "busy"` is the one rejection the client explains to the visitor (see protocol.ts). */
export type ActionResult = { ok: true } | { ok: false; message: string; code?: "busy" };
type RoomOptions = { countdownMs?: number };

/**
 * One race room: the first player in is the leader, who adds/removes bots,
 * picks how they drive and decides when to start (never a timer) — then the
 * start lights run, and the room runs the authoritative simulation at
 * `TICK_RATE` and broadcasts every `SEND_EVERY` ticks.
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
  /** Each bot's difficulty, chosen by the leader per bot (the same styles as practice mode's). */
  private readonly botDifficulty = new Map<string, Difficulty>();
  private humanIds: string[] = [];
  /** Tick at which every human was done, for the bots' grace period. */
  private humansDoneAt: number | null = null;
  private raceState: RaceState | null = null;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  /** Wall-clock time (ms) the next tick is due; see `loop`. */
  private nextTickAt = 0;
  /** Events of ticks not sent yet (`SEND_EVERY`). */
  private pendingEvents: RaceEvent[] = [];
  private lastSentTick = 0;
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

  /** Counts against `MAX_RACING_ROOMS` (see RoomService). */
  get isRacing() {
    return this.state === "countdown" || this.state === "racing";
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
    this.botDifficulty.set(carId, "normal");
    this.broadcastLobby();
    return { ok: true };
  }

  removeBot(client: RoomClient): ActionResult {
    if (this.state !== "waiting") return { ok: false, message: "race already started" };
    if (!this.isLeader(client)) return { ok: false, message: "only the leader can remove bots" };
    const carId = this.botOrder.pop();
    if (!carId) return { ok: false, message: "no bots to remove" };
    this.numbers.delete(carId);
    this.botDifficulty.delete(carId);
    this.broadcastLobby();
    return { ok: true };
  }

  /** `data` comes off the wire: `{ bot, difficulty }`, checked here. */
  setBotDifficulty(client: RoomClient, data: unknown): ActionResult {
    if (this.state !== "waiting") return { ok: false, message: "race already started" };
    if (!this.isLeader(client)) {
      return { ok: false, message: "only the leader can set a bot's difficulty" };
    }
    const { bot, difficulty } = (data ?? {}) as { bot?: unknown; difficulty?: unknown };
    const id = this.botOrder.find((b) => b === bot);
    if (!id) return { ok: false, message: "unknown bot" };
    const d = DIFFICULTIES.find((x) => x === difficulty);
    if (!d) return { ok: false, message: "unknown difficulty" };
    this.botDifficulty.set(id, d);
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
      this.nextTickAt = Date.now() + STEP_MS;
      this.schedule();
    }, this.countdownMs).unref();
    return { ok: true };
  }

  /**
   * Fixed-timestep loop. A plain `setInterval(tick, 33.3)` ran at only ~23
   * ticks/s on Windows (timers there fire on a 15.6 ms grid, so 33.3 ms became
   * 46.9 ms) and drifts on Linux too, since each late callback pushes the next
   * one back: the online race ran slower than practice mode. Here the room
   * keeps the wall-clock time the next tick is due and, whenever the timer
   * fires, runs every tick that time owes — so the race keeps real time even
   * when timers are coarse or late.
   */
  private schedule() {
    const delay = Math.max(0, this.nextTickAt - Date.now());
    this.tickTimer = setTimeout(() => this.loop(), delay).unref();
  }

  private loop() {
    this.tickTimer = null;
    const now = Date.now();
    let ran = 0;
    while (this.state === "racing" && now >= this.nextTickAt && ran < MAX_CATCH_UP) {
      this.tick();
      this.nextTickAt += STEP_MS;
      ran++;
    }
    // Hopelessly behind: carry on from now rather than replay the backlog.
    if (now - this.nextTickAt > MAX_CATCH_UP * STEP_MS) this.nextTickAt = now + STEP_MS;
    if (this.state === "racing") this.schedule();
  }

  private tick() {
    if (!this.raceState) return;
    const inputs: Record<string, Keys> = {};
    for (const car of this.raceState.cars) {
      const bot = this.botOrder.indexOf(car.id);
      if (bot === -1) {
        inputs[car.id] = this.keys.get(car.id) ?? NO_KEYS;
        continue;
      }
      // Bots of the same difficulty still drive a little differently (the three styles).
      const styles = BOT_STYLES[this.botDifficulty.get(car.id) ?? "normal"];
      inputs[car.id] = botKeys(car, this.track, styles[bot % styles.length]);
    }
    const s = stepRace(this.raceState, this.track, inputs);
    this.raceState = s;

    this.pendingEvents.push(...s.events);
    if (s.tick % SEND_EVERY === 0) this.sendState();

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

  /** The latest tick plus every event since the last message, in the compact format. */
  private sendState() {
    if (!this.raceState) return;
    this.broadcast({ type: "state", ...encodeTick(this.raceState, this.pendingEvents) });
    this.pendingEvents = [];
    this.lastSentTick = this.raceState.tick;
  }

  private finish() {
    if (!this.raceState || this.state === "done") return;
    // The last tick (and its events, e.g. the final lap) may not have gone out yet.
    if (this.state === "racing" && this.raceState.tick > this.lastSentTick) this.sendState();
    if (this.tickTimer) clearTimeout(this.tickTimer);
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
      ...this.botOrder.map((id) => ({
        id,
        number: this.numbers.get(id)!,
        isBot: true,
        difficulty: this.botDifficulty.get(id) ?? "normal",
      })),
    ];
    this.broadcast({ type: "lobby", participants, leaderId });
  }

  private send(client: RoomClient, message: ServerMessage) {
    client.send(JSON.stringify(message));
  }

  /**
   * One JSON encoding for everyone. A client whose unsent data has piled up
   * past `MAX_BUFFERED_BYTES` (a stalled phone, a dead network) is closed
   * instead of buffering forever; it can't simply skip messages, because the
   * client rebuilds items and lap times from the events in every one.
   */
  private broadcast(message: ServerMessage) {
    const body = JSON.stringify(message);
    for (const client of this.players.keys()) {
      if ((client.bufferedAmount ?? 0) > MAX_BUFFERED_BYTES) {
        client.close?.(CLOSE_TOO_SLOW, "too slow");
        continue;
      }
      client.send(body);
    }
  }
}
