import { botKeys, classicTrack, RaceDecoder, type WireTick } from "race-engine/node";
import { CLOSE_TOO_SLOW, MAX_BUFFERED_BYTES } from "./limits";
import { COUNTDOWN_MS, Room, SEND_EVERY, type RoomClient } from "./room";

type Msg = { type: string } & Record<string, unknown>;
const ofType = (c: { messages: unknown[] }, type: string) =>
  c.messages.filter((m) => (m as Msg).type === type) as Msg[];

function fakeClient(): RoomClient & { messages: unknown[] } {
  const messages: unknown[] = [];
  return {
    messages,
    send(data: string) {
      messages.push(JSON.parse(data));
    },
  };
}

function lastLobby(client: RoomClient & { messages: unknown[] }) {
  const lobbies = client.messages.filter((m) => (m as { type: string }).type === "lobby");
  return lobbies.at(-1) as {
    participants: {
      id: string;
      number: number;
      color: number;
      isBot: boolean;
      difficulty?: string;
    }[];
    leaderId: string | null;
  };
}

describe("Room", () => {
  test("every car gets its own colour, players and bots alike", () => {
    const room = new Room("c1", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);
    room.addBot(alice);
    expect(lastLobby(alice).participants.map((p) => p.color)).toEqual([0, 1, 2]);
  });

  test("a player can take a bot's colour (they swap) but not another player's", () => {
    const room = new Room("c2", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);
    room.addBot(alice);

    expect(room.setColor(bob, { color: 0 })).toEqual(
      expect.objectContaining({ ok: false, message: "color taken" }),
    );
    expect(room.setColor(bob, { color: 2 })).toEqual({ ok: true });
    expect(lastLobby(alice).participants.map((p) => p.color)).toEqual([0, 2, 1]);
    expect(room.setColor(bob, { color: 7 })).toEqual({ ok: true });
    expect(lastLobby(alice).participants.map((p) => p.color)).toEqual([0, 7, 1]);
  });

  test("colours off the wire are checked", () => {
    const room = new Room("c3", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);
    for (const color of [-1, 10, 1.5, "2", null]) {
      expect(room.setColor(alice, { color })).toEqual(
        expect.objectContaining({ ok: false, message: "unknown color" }),
      );
    }
    expect(room.setColor(alice, undefined).ok).toBe(false);
  });

  test("the start message carries every car's colour", () => {
    const room = new Room("c4", jest.fn(), jest.fn(), undefined, { countdownMs: 0 });
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    room.setColor(alice, { color: 5 });
    room.startRace(alice);
    const start = ofType(alice, "start")[0]!;
    expect(Object.values(start.colors as Record<string, number>).sort()).toEqual([1, 5]);
  });

  test("the first join gets number 1 and becomes the leader", () => {
    const room = new Room("r1", jest.fn(), jest.fn());
    const alice = fakeClient();

    room.join(alice);

    const welcome = alice.messages[0] as { type: string; number: number; playerId: string };
    expect(welcome).toEqual(expect.objectContaining({ type: "welcome", number: 1, roomId: "r1" }));
    expect(room.state).toBe("waiting");
    expect(lastLobby(alice).leaderId).toBe(welcome.playerId);
  });

  test("a second joiner gets the next number and isn't the leader", () => {
    const room = new Room("r2", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();

    room.join(alice);
    room.join(bob);

    expect((bob.messages[0] as { number: number }).number).toBe(2);
    const lobby = lastLobby(alice);
    expect(lobby.participants.map((p) => p.number)).toEqual([1, 2]);
    expect(lobby.leaderId).toBe((alice.messages[0] as { playerId: string }).playerId);
  });

  test("joining never starts the race by itself, no matter how many join", () => {
    const room = new Room("r3", jest.fn(), jest.fn());
    for (const c of Array.from({ length: 10 }, fakeClient)) room.join(c);

    expect(room.state).toBe("waiting");
  });

  test("only the leader can add or remove bots", () => {
    const room = new Room("r4", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);

    expect(room.addBot(bob)).toEqual({ ok: false, message: expect.any(String) });
    expect(room.addBot(alice)).toEqual({ ok: true });
    expect(lastLobby(alice).participants.some((p) => p.isBot)).toBe(true);

    expect(room.removeBot(bob)).toEqual({ ok: false, message: expect.any(String) });
    expect(room.removeBot(alice)).toEqual({ ok: true });
    expect(lastLobby(alice).participants.some((p) => p.isBot)).toBe(false);
  });

  test("removing a bot with none present fails instead of throwing", () => {
    const room = new Room("r5", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);

    expect(room.removeBot(alice)).toEqual({ ok: false, message: expect.any(String) });
  });

  test("the leader can't start alone: at least 2 participants are required", () => {
    const room = new Room("r6", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);

    expect(room.startRace(alice)).toEqual({
      ok: false,
      message: expect.stringContaining("2"),
    });
    expect(room.state).toBe("waiting");
  });

  test("one human plus one bot is enough to start", () => {
    const room = new Room("r7", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);

    expect(room.startRace(alice)).toEqual({ ok: true });
    expect(room.state).toBe("countdown");
  });

  test("a non-leader can't start the race", () => {
    const room = new Room("r8", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);

    expect(room.startRace(bob)).toEqual({ ok: false, message: expect.any(String) });
    expect(room.state).toBe("waiting");
  });

  test("the last player leaving an unstarted room tells the manager it's empty", () => {
    const onEmpty = jest.fn();
    const room = new Room("r10", onEmpty, jest.fn());
    const alice = fakeClient();
    room.join(alice);

    room.leave(alice);

    expect(onEmpty).toHaveBeenCalledWith(room);
  });

  test("the leader leaving hands leadership to the next player in line", () => {
    const room = new Room("r11", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);
    const bobId = (bob.messages[0] as { playerId: string }).playerId;

    room.leave(alice);

    expect(lastLobby(bob).leaderId).toBe(bobId);
    expect(room.startRace(alice)).toEqual({ ok: false, message: expect.any(String) });
  });

  test("a player leaving mid-race stops reading its input instead of removing the car", () => {
    jest.useFakeTimers();
    const room = new Room("r12", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);
    room.startRace(alice);

    jest.advanceTimersByTime(COUNTDOWN_MS);

    expect(() => room.leave(alice)).not.toThrow();
    expect(room.state).toBe("racing");
    jest.useRealTimers();
  });

  test("only the leader sets each bot's difficulty, and only a known one", () => {
    const room = new Room("r14", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);
    room.addBot(alice);
    room.addBot(alice);
    const [first, second] = lastLobby(bob).participants.filter((p) => p.isBot);
    expect([first!.difficulty, second!.difficulty]).toEqual(["normal", "normal"]);
    const no = { ok: false, message: expect.any(String) };

    expect(room.setBotDifficulty(bob, { bot: first!.id, difficulty: "hard" })).toEqual(no);
    expect(room.setBotDifficulty(alice, { bot: first!.id, difficulty: "insane" })).toEqual(no);
    expect(room.setBotDifficulty(alice, { bot: "p-0-1", difficulty: "hard" })).toEqual(no);
    expect(room.setBotDifficulty(alice, "hard")).toEqual(no);
    expect(room.setBotDifficulty(alice, { bot: first!.id, difficulty: "hard" })).toEqual({
      ok: true,
    });
    const bots = lastLobby(bob).participants.filter((p) => p.isBot);
    expect(bots.map((p) => p.difficulty)).toEqual(["hard", "normal"]);
  });

  test("once every human is gone the race ends (after a moment to come back), not ticking on for nobody", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    const room = new Room("r15", jest.fn(), onDone);
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    room.startRace(alice);
    jest.advanceTimersByTime(COUNTDOWN_MS + 100);

    room.leave(alice);
    expect(room.state).toBe("racing");
    jest.advanceTimersByTime(10_000);

    expect(room.state).toBe("done");
    expect(onDone).toHaveBeenCalledWith(room);
    jest.useRealTimers();
  });

  test("coming back mid-race: same car, and the race so far right after the next state", () => {
    jest.useFakeTimers();
    const room = new Room("r15b", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    room.startRace(alice);
    jest.advanceTimersByTime(COUNTDOWN_MS + 1000);
    const { seat, playerId } = alice.messages[0] as { seat: string; playerId: string };
    room.leave(alice);

    const back = fakeClient();
    expect(room.rejoin(back, "nope-nope-no")).toBe(false);
    expect(room.rejoin(back, seat)).toBe(true);
    // The seat is taken again: nobody else can claim it.
    expect(room.rejoin(fakeClient(), seat)).toBe(false);
    jest.advanceTimersByTime(200);

    expect(back.messages[0]).toEqual(expect.objectContaining({ playerId, rejoined: true }));
    const sync = ofType(back, "sync")[0]!;
    expect(sync.carIds).toEqual([playerId, expect.any(String)]);
    // From the sync on, the decoder follows the race like everyone else's.
    const decoder = new RaceDecoder(classicTrack, sync.carIds as string[], 2);
    const state = decoder.resume(sync as unknown as Parameters<RaceDecoder["resume"]>[0]);
    expect(state.tick).toBeGreaterThan(0);
    const after = ofType(back, "state").filter((m) => (m.t as number) > state.tick);
    expect(after.length).toBeGreaterThan(0);
    jest.useRealTimers();
  });

  test("a spectator gets the race but can't drive", () => {
    jest.useFakeTimers();
    const room = new Room("r15c", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    room.startRace(alice);
    jest.advanceTimersByTime(COUNTDOWN_MS + 500);
    const viewer = fakeClient();

    room.watch(viewer);
    room.setInput(viewer, { up: true, down: false, left: false, right: false, nitro: false });
    jest.advanceTimersByTime(200);

    expect(viewer.messages[0]).toEqual(expect.objectContaining({ type: "spectate" }));
    expect(ofType(viewer, "sync")).toHaveLength(1);
    expect(ofType(viewer, "state").length).toBeGreaterThan(0);
    jest.useRealTimers();
  });

  test("one human leaving mid-race doesn't end it while another is still driving", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    const room = new Room("r16", jest.fn(), onDone);
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);
    room.addBot(alice);
    room.startRace(alice);
    jest.advanceTimersByTime(COUNTDOWN_MS + 100);
    room.leave(bob);
    jest.advanceTimersByTime(2000);

    expect(room.state).toBe("racing");
    expect(onDone).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
  test("the race keeps real time: 30 ticks a second, sent every 2nd tick", () => {
    // A setInterval loop ran at ~23 ticks/s on Windows; the fixed-timestep loop
    // runs whatever ticks the wall clock owes, so 1 s of race is 30 ticks.
    jest.useFakeTimers();
    const room = new Room("r9", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    room.startRace(alice);

    jest.advanceTimersByTime(COUNTDOWN_MS + 1000);

    const ticks = ofType(alice, "state").map((m) => m.t as number);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(29);
    expect(ticks.at(-1)).toBeLessThanOrEqual(30);
    expect(ticks.every((t) => t % SEND_EVERY === 0)).toBe(true);
    jest.useRealTimers();
  });

  test("a late timer is caught up, not lost: the race still advances in real time", () => {
    jest.useFakeTimers();
    const room = new Room("r9b", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    room.startRace(alice);
    jest.advanceTimersByTime(COUNTDOWN_MS);

    // The process stalls for 100 ms (a GC pause, CPU throttling): the clock
    // moves on without any timer firing, then the first tick's timer fires late.
    jest.setSystemTime(Date.now() + 100);
    jest.advanceTimersByTime(34);

    // That one late callback ran every tick the 134 ms owed (4), not just one.
    const last = ofType(alice, "state").at(-1)!;
    expect(last.t).toBe(4);
    jest.useRealTimers();
  });

  test("the start lights run before the first tick, and keys held during them count", () => {
    jest.useFakeTimers();
    const room = new Room("r13", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    room.startRace(alice);

    const start = ofType(alice, "start")[0]!;
    expect(start).toEqual(expect.objectContaining({ countdownMs: COUNTDOWN_MS }));
    room.setInput(alice, { up: true, down: false, left: false, right: false, nitro: false });
    jest.advanceTimersByTime(COUNTDOWN_MS - 1);
    expect(ofType(alice, "state")).toHaveLength(0);

    jest.advanceTimersByTime(100);
    const state = ofType(alice, "state")[0] as unknown as WireTick;
    const me = (start.carIds as string[]).indexOf((alice.messages[0] as Msg).playerId as string);
    // [x, y, rotation, vx, …] — see race-engine's wire.ts.
    expect(state.c[me]![3]).not.toBe(0);
    jest.useRealTimers();
  });

  test("a client rebuilds the whole race from the messages, final lap included", () => {
    // Messages carry every 2nd tick plus the events in between, and the last
    // tick is flushed before "finished": decoding them must give the full
    // race — both laps of the human, the finishing order, no event lost.
    jest.useFakeTimers();
    const room = new Room("r17", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    const bot = lastLobby(alice).participants.find((p) => p.isBot)!.id;
    room.setBotDifficulty(alice, { bot, difficulty: "easy" });
    room.startRace(alice);
    const start = ofType(alice, "start")[0]!;
    const carIds = start.carIds as string[];
    const me = (alice.messages[0] as Msg).playerId as string;
    const decoder = new RaceDecoder(classicTrack, carIds, 2);
    let decoded = decoder.initial();
    let seen = 0;
    jest.advanceTimersByTime(COUNTDOWN_MS);

    while (room.state !== "done" && decoded.tick < 30 * 150) {
      jest.advanceTimersByTime(100);
      for (const m of ofType(alice, "state").slice(seen)) {
        decoded = decoder.apply(m as unknown as WireTick);
        seen++;
      }
      // Alice drives like a top bot, from what she sees.
      const car = decoded.cars.find((c) => c.id === me)!;
      room.setInput(alice, botKeys(car, classicTrack, { skill: 1 }));
    }
    for (const m of ofType(alice, "state").slice(seen))
      decoded = decoder.apply(m as unknown as WireTick);

    const finished = ofType(alice, "finished")[0]!;
    const standings = finished.standings as { carId: string; lapTicks: number[] }[];
    const mine = decoded.cars.find((c) => c.id === me)!;
    expect(mine.finishedAt).not.toBeNull();
    expect(mine.lapTicks).toEqual(standings.find((s) => s.carId === me)!.lapTicks);
    expect(decoded.finished).toEqual(
      standings.filter((s) => s.lapTicks.length === 2).map((s) => s.carId),
    );
    jest.useRealTimers();
  });

  test("a client too far behind is closed instead of buffering forever", () => {
    jest.useFakeTimers();
    const room = new Room("r18", jest.fn(), jest.fn());
    const alice = fakeClient();
    const close = jest.fn();
    const stalled: RoomClient = { send: jest.fn(), bufferedAmount: MAX_BUFFERED_BYTES + 1, close };
    room.join(alice);
    room.join(stalled);
    room.startRace(alice);

    expect(close).toHaveBeenCalledWith(CLOSE_TOO_SLOW, expect.any(String));
    jest.useRealTimers();
  });
});
