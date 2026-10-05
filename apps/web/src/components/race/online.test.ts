import {
  apiWsUrl,
  applyServerMessage,
  initialOnlineState,
  isLeader,
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
    });
    expect(next.participants).toHaveLength(1);
    expect(next.leaderId).toBe("p-0-1");
    expect(next.error).toBeNull();
  });

  test("a lobby broadcast once racing is ignored: the roster is frozen", () => {
    const racing: OnlineState = { ...initialOnlineState, phase: "racing", participants: [] };
    const next = applyServerMessage(racing, {
      type: "lobby",
      participants: [{ id: "p-0-1", number: 1, isBot: false }],
      leaderId: "p-0-1",
    });
    expect(next).toBe(racing);
  });

  test("start records the grid and switches to racing", () => {
    const next = applyServerMessage(
      { ...initialOnlineState, phase: "lobby" },
      { type: "start", carIds: ["p-0-1", "b-0-2"], numbers: { "p-0-1": 1, "b-0-2": 2 } },
    );
    expect(next.phase).toBe("racing");
    expect(next.carIds).toEqual(["p-0-1", "b-0-2"]);
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
