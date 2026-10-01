import {
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
/** Bots fill the room up to this many racers if fewer people joined (never past `CAPACITY`). */
const MIN_RACERS = 4;
/** How long a room waits for more players before filling the rest with bots and starting. */
const WAIT_MS = 8_000;
/** Safety net so an abandoned room doesn't tick forever: 2 laps rarely take this long. */
const MAX_TICKS = TICK_RATE * 150;
/** Every filler bot drives the same way: full speed, uses nitro (see `BotStyle`). */
const BOT_STYLE: BotStyle = { skill: 1 };

type Player = { carId: string; name: string };

/**
 * One race room: gathers players, fills empty seats with bots once the wait
 * window is up, then runs the authoritative simulation at `TICK_RATE` and
 * broadcasts every tick. Names are assigned here ("Piloto N"), never chosen
 * by a client.
 */
export class Room {
  readonly id: string;
  state: "waiting" | "racing" | "done" = "waiting";

  private readonly players = new Map<RoomClient, Player>();
  private readonly bots = new Map<string, BotStyle>();
  private readonly names = new Map<string, string>();
  private readonly keys = new Map<string, Keys>();
  private nextPilotNumber = 1;
  private raceState: RaceState | null = null;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    id: string,
    private readonly onEmpty: (room: Room) => void,
    private readonly onDone: (room: Room) => void,
    private readonly waitMs = WAIT_MS,
    private readonly track = classicTrack,
  ) {
    this.id = id;
  }

  get playerCount() {
    return this.players.size;
  }

  /** Assigns a car and a "Piloto N" name, and starts the room's wait window on the first join. */
  join(client: RoomClient): Player {
    const name = `Piloto ${this.nextPilotNumber++}`;
    const player: Player = { carId: `p-${this.players.size}-${name}`, name };
    this.players.set(client, player);
    this.names.set(player.carId, name);
    this.keys.set(player.carId, NO_KEYS);

    this.send(client, {
      type: "welcome",
      playerId: player.carId,
      name: player.name,
      roomId: this.id,
      laps: LAPS,
      tickRate: TICK_RATE,
    });
    this.broadcastRoster();

    if (this.players.size === 1) {
      this.waitTimer = setTimeout(() => this.start(), this.waitMs);
    } else if (this.players.size >= CAPACITY) {
      this.start();
    }
    return player;
  }

  leave(client: RoomClient) {
    const player = this.players.get(client);
    if (!player) return;
    this.players.delete(client);
    if (this.state === "waiting") {
      this.broadcastRoster();
      if (this.players.size === 0) {
        if (this.waitTimer) clearTimeout(this.waitTimer);
        this.onEmpty(this);
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

  private start() {
    if (this.state !== "waiting") return;
    if (this.waitTimer) clearTimeout(this.waitTimer);
    if (this.players.size === 0) {
      this.onEmpty(this);
      return;
    }

    const humanIds = [...this.players.values()].map((p) => p.carId);
    const botCount = Math.min(CAPACITY, Math.max(MIN_RACERS, humanIds.length)) - humanIds.length;
    const botIds: string[] = [];
    for (let i = 0; i < botCount; i++) {
      const name = `Piloto ${this.nextPilotNumber++}`;
      const carId = `b-${i}-${name}`;
      this.bots.set(carId, BOT_STYLE);
      this.names.set(carId, name);
      botIds.push(carId);
    }

    const carIds = [...humanIds, ...botIds];
    this.raceState = createRace(this.track, carIds, LAPS);
    this.state = "racing";

    const names = Object.fromEntries(carIds.map((id) => [id, this.names.get(id)!]));
    this.broadcast({ type: "start", carIds, names });

    this.tickTimer = setInterval(() => this.tick(), 1000 / TICK_RATE);
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
        name: this.names.get(c.id) ?? c.id,
        laps: c.laps,
        lapTicks: c.lapTicks,
        finishedAt: c.finishedAt,
      })),
    });
    this.onDone(this);
  }

  private broadcastRoster() {
    const secondsLeft = Math.round(this.waitMs / 1000);
    this.broadcast({
      type: "roster",
      names: [...this.players.values()].map((p) => p.name),
      secondsLeft,
    });
  }

  private send(client: RoomClient, message: ServerMessage) {
    client.send(JSON.stringify(message));
  }

  private broadcast(message: ServerMessage) {
    const body = JSON.stringify(message);
    for (const client of this.players.keys()) client.send(body);
  }
}
