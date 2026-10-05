import { activeItems, classicTrack, standings, wrongWay } from "race-engine";
import {
  apiWsUrl,
  applyServerMessage,
  initialOnlineState,
  isLeader,
  toRaceState,
  type CarSnapshot,
  type OnlineState,
} from "./online";

describe("applyServerMessage", () => {
  test("welcome moves to the lobby and records who you are", () => {
    const next = applyServerMessage(initialOnlineState, {
      type: "welcome",
      playerId: "p-0-1",
      number: 1,
      roomId: "r1",
      laps: 2,
      tickRate: 30,
    });
    expect(next.phase).toBe("lobby");
    expect(next.playerId).toBe("p-0-1");
  });

  test("lobby updates the roster and leader, and clears a previous error", () => {
    const withError: OnlineState = { ...initialOnlineState, phase: "lobby", error: "nope" };
    const next = applyServerMessage(withError, {
      type: "lobby",
      participants: [{ id: "p-0-1", number: 1, isBot: false }],
      leaderId: "p-0-1",
      difficulty: "hard",
    });
    expect(next.participants).toHaveLength(1);
    expect(next.leaderId).toBe("p-0-1");
    expect(next.error).toBeNull();
    expect(next.difficulty).toBe("hard");
  });

  test("a lobby broadcast once racing is ignored: the roster is frozen", () => {
    const racing: OnlineState = { ...initialOnlineState, phase: "racing", participants: [] };
    const next = applyServerMessage(racing, {
      type: "lobby",
      participants: [{ id: "p-0-1", number: 1, isBot: false }],
      leaderId: "p-0-1",
      difficulty: "hard",
    });
    expect(next).toBe(racing);
  });

  test("start records the grid and turns the start lights on", () => {
    const next = applyServerMessage(
      { ...initialOnlineState, phase: "lobby" },
      {
        type: "start",
        carIds: ["p-0-1", "b-0-2"],
        numbers: { "p-0-1": 1, "b-0-2": 2 },
        countdownMs: 3000,
      },
    );
    expect(next.phase).toBe("countdown");
    expect(next.countdownMs).toBe(3000);
    expect(next.carIds).toEqual(["p-0-1", "b-0-2"]);
  });

  test("lights out races, crossing the line is finishing, and skip shows the results", () => {
    const countdown: OnlineState = { ...initialOnlineState, phase: "countdown" };
    const racing = applyServerMessage(countdown, { type: "lights-out" });
    expect(racing.phase).toBe("racing");
    const finishing = applyServerMessage(racing, { type: "you-finished" });
    expect(finishing.phase).toBe("finishing");
    const skipped = applyServerMessage(finishing, { type: "skip" });
    expect(skipped.phase).toBe("finished");
    expect(skipped.standings).toBeNull();
    // Out of turn, they change nothing.
    expect(applyServerMessage(racing, { type: "skip" })).toBe(racing);
    expect(applyServerMessage(finishing, { type: "lights-out" })).toBe(finishing);
  });

  test("losing the connection after the race keeps the results up", () => {
    const finished: OnlineState = { ...initialOnlineState, phase: "finished" };
    expect(applyServerMessage(finished, { type: "room-closed" })).toBe(finished);
  });

  test("reconnect starts over from connecting", () => {
    const next = applyServerMessage(
      { ...initialOnlineState, phase: "finished", playerId: "p-0-1" },
      { type: "reconnect" },
    );
    expect(next).toEqual(initialOnlineState);
  });

  test("finished records the standings", () => {
    const standings = [
      { carId: "p-0-1", number: 1, laps: 2, lapTicks: [100, 110], finishedAt: 210 },
    ];
    const next = applyServerMessage(
      { ...initialOnlineState, phase: "racing" },
      { type: "finished", standings },
    );
    expect(next.phase).toBe("finished");
    expect(next.standings).toBe(standings);
  });

  test("error is recorded but never changes the phase", () => {
    const next = applyServerMessage(
      { ...initialOnlineState, phase: "lobby" },
      { type: "error", message: "only the leader can start the race" },
    );
    expect(next.phase).toBe("lobby");
    expect(next.error).toBe("only the leader can start the race");
  });

  test("room-closed disconnects", () => {
    const next = applyServerMessage(
      { ...initialOnlineState, phase: "racing" },
      { type: "room-closed" },
    );
    expect(next.phase).toBe("disconnected");
  });

  test("a tick's state message is a no-op: it drives the render loop, not React state", () => {
    const state: OnlineState = { ...initialOnlineState, phase: "racing" };
    const next = applyServerMessage(state, {
      type: "state",
      tick: 5,
      cars: [],
      items: [],
      finished: [],
      events: [],
    });
    expect(next).toBe(state);
  });
});

describe("isLeader", () => {
  test("true only once you know your own id and it matches the leader's", () => {
    expect(isLeader(initialOnlineState)).toBe(false);
    expect(isLeader({ ...initialOnlineState, playerId: "p-0-1", leaderId: "p-0-1" })).toBe(true);
    expect(isLeader({ ...initialOnlineState, playerId: "p-0-1", leaderId: "p-0-2" })).toBe(false);
  });
});

describe("apiWsUrl", () => {
  test("falls back to localhost when NEXT_PUBLIC_API_URL isn't set", () => {
    expect(apiWsUrl()).toBe("ws://localhost:17100");
  });
});

describe("toRaceState", () => {
  const car = (id: string, extra: Partial<CarSnapshot> = {}): CarSnapshot => ({
    id,
    x: 300,
    y: 520,
    rotation: 0,
    vx: 0,
    vy: 0,
    checkpoint: 0,
    waypoint: 0,
    laps: 0,
    nitro: 0,
    nitroUntil: null,
    finishedAt: null,
    lapTicks: [],
    ...extra,
  });
  const ids = classicTrack.items.map((it) => it.id);

  test("gives the engine's helpers a full race: standings, items and wrong way all work", () => {
    const [first, ...rest] = ids;
    const s = toRaceState(
      {
        type: "state",
        tick: 40,
        cars: [car("a"), car("b", { laps: 1, finishedAt: 30, lapTicks: [30] })],
        items: rest,
        finished: ["b"],
        events: [],
      },
      2,
      ids,
    );
    expect(s.cars[0]).toEqual(expect.objectContaining({ width: 25, height: 25, x: 300 }));
    expect(standings(s, classicTrack).map((c) => c.id)).toEqual(["b", "a"]);
    expect(activeItems(classicTrack, s).map((it) => it.id)).not.toContain(first);
    expect(activeItems(classicTrack, s)).toHaveLength(ids.length - 1);
    expect(wrongWay(s.cars[0]!, classicTrack)).toBe(false);
  });
});
