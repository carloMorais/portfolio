import {
  activeItems,
  botKeys,
  classicTrack,
  createRace,
  NO_KEYS,
  standings,
  stepRace,
  TICK_RATE,
  type BotStyle,
  type Keys,
  type RaceState,
} from "race-engine/node";
import type { ServerMessage } from "./protocol";

/** Anything the room can send a message to; `ws.WebSocket` satisfies this, so do test doubles. */
export type RoomClient = { send(data: string): void };

const LAPS = 2;
const CAPACITY = 10;
/** Safety net so an abandoned room doesn't tick forever: 2 laps rarely take this long. */
const MAX_TICKS = TICK_RATE * 150;
/** Every bot drives the same way: full speed, uses nitro (see `BotStyle`). */
const BOT_STYLE: BotStyle = { skill: 1 };
/** The leader can't start alone: a lone human racing bots felt like practice mode, not online. */
const MIN_PARTICIPANTS = 2;

type Player = { carId: string; number: number };
type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * One race room: the first player in is the leader, who adds/removes bots and
 * decides when to start (never a timer) — then the room runs the
 * authoritative simulation at `TICK_RATE` and broadcasts every tick.
 *
 * Each racer (human or bot) only gets a sequential number, never a name
 * string: the site is bilingual, and "Piloto N"/"Driver N" has to be worded
 * by the client in the viewer's own language, not hardcoded here.
 */
export class Room {
  readonly id: string;
  state: "waiting" | "racing" | "done" = "waiting";

  private readonly players = new Map<RoomClient, Player>();
  /** Join order, oldest first: index 0 is the leader. */
  private readonly playerOrder: RoomClient[] = [];
  private readonly bots = new Map<string, BotStyle>();
  /** Bots in the order they were added, so "remove" takes the most recent one. */
  private readonly botOrder: string[] = [];
  private readonly numbers = new Map<string, number>();
  private readonly keys = new Map<string, Keys>();
  private nextNumber = 1;
  private raceState: RaceState | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    id: string,
    private readonly onEmpty: (room: Room) => void,
    private readonly onDone: (room: Room) => void,
    private readonly track = classicTrack,
  ) {
    this.id = id;
  }

  get playerCount() {
    return this.players.size;
  }

  get isFull() {
    return this.players.size + this.bots.size >= CAPACITY;
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
    }
  }

  setInput(client: RoomClient, keys: Keys) {
    const player = this.players.get(client);
    if (!player || this.state !== "racing") return;
    this.keys.set(player.carId, keys);
  }

  addBot(client: RoomClient): ActionResult {
    if (this.state !== "waiting") return { ok: false, message: "race already started" };
    if (!this.isLeader(client)) return { ok: false, message: "only the leader can add bots" };
    if (this.players.size + this.bots.size >= CAPACITY) {
      return { ok: false, message: "room is full" };
    }
    const number = this.nextNumber++;
    const carId = `b-${this.botOrder.length}-${number}`;
    this.bots.set(carId, BOT_STYLE);
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
    this.bots.delete(carId);
    this.numbers.delete(carId);
    this.broadcastLobby();
    return { ok: true };
  }

  startRace(client: RoomClient): ActionResult {
    if (this.state !== "waiting") return { ok: false, message: "race already started" };
    if (!this.isLeader(client)) return { ok: false, message: "only the leader can start the race" };
    const total = this.players.size + this.bots.size;
    if (total < MIN_PARTICIPANTS) {
      return { ok: false, message: `need at least ${MIN_PARTICIPANTS} players` };
    }

    const humanIds = [...this.players.values()].map((p) => p.carId);
    const carIds = [...humanIds, ...this.botOrder];
    this.raceState = createRace(this.track, carIds, LAPS);
    this.state = "racing";

    const numbers = Object.fromEntries(carIds.map((id) => [id, this.numbers.get(id)!]));
    this.broadcast({ type: "start", carIds, numbers });

    // unref: a room ticking away doesn't need to keep the process (or a test) alive by itself.
    this.tickTimer = setInterval(() => this.tick(), 1000 / TICK_RATE).unref();
    return { ok: true };
  }

  private tick() {
    if (!this.raceState) return;
    const inputs: Record<string, Keys> = {};
    for (const car of this.raceState.cars) {
      const style = this.bots.get(car.id);
      inputs[car.id] = style ? botKeys(car, this.track, style) : (this.keys.get(car.id) ?? NO_KEYS);
    }
    this.raceState = stepRace(this.raceState, this.track, inputs);

    this.broadcast({
      type: "state",
      tick: this.raceState.tick,
      cars: this.raceState.cars.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        rotation: c.rotation,
        laps: c.laps,
        nitro: c.nitro,
        finishedAt: c.finishedAt,
      })),
      items: activeItems(this.track, this.raceState).map((it) => it.id),
      events: this.raceState.events,
    });

    const allFinished = this.raceState.cars.every((c) => c.finishedAt !== null);
    if (allFinished || this.raceState.tick >= MAX_TICKS) this.finish();
  }

  private finish() {
    if (!this.raceState || !this.tickTimer) return;
    clearInterval(this.tickTimer);
    this.tickTimer = null;
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
    this.broadcast({ type: "lobby", participants, leaderId });
  }

  private send(client: RoomClient, message: ServerMessage) {
    client.send(JSON.stringify(message));
  }

  private broadcast(message: ServerMessage) {
    const body = JSON.stringify(message);
    for (const client of this.players.keys()) client.send(body);
  }
}
