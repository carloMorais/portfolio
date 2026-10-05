import {
  apiHttpUrl,
  apiWsUrl,
  applyServerMessage,
  colorIndex,
  initialOnlineState,
  inviteUrl,
  isLeader,
  isRoomCode,
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
      seat: "abcdefghijkl",
    });
    expect(next.phase).toBe("lobby");
    expect(next.playerId).toBe("p-0-1");
    expect(next.roomId).toBe("r1");
  });

  test("dropped mid-race: reconnecting, then back in the car without passing the lobby", () => {
    const racing: OnlineState = { ...initialOnlineState, phase: "racing", playerId: "p-0-1" };
    const waiting = applyServerMessage(racing, { type: "reconnecting" });
    expect(waiting.phase).toBe("reconnecting");
    const back = applyServerMessage(waiting, {
      type: "welcome",
      playerId: "p-0-1",
      number: 1,
      roomId: "r1",
      laps: 2,
      tickRate: 30,
      seat: "abcdefghijkl",
      rejoined: true,
    });
    expect(back.phase).toBe("reconnecting");
    const synced = applyServerMessage(back, {
      type: "sync",
      carIds: ["p-0-1"],
      numbers: { "p-0-1": 1 },
      colors: { "p-0-1": 3 },
      lapTicks: [[]],
      finished: [],
      picked: {},
      state: { t: 90, c: [] },
    });
    expect(synced.phase).toBe("racing");
    expect(colorIndex(synced, "p-0-1")).toBe(3);
  });

  test("too late for an invite's race: watching it", () => {
    const next = applyServerMessage(initialOnlineState, {
      type: "spectate",
      roomId: "abcdef",
      laps: 2,
      tickRate: 30,
    });
    expect(next.spectating).toBe(true);
    expect(next.roomId).toBe("abcdef");
    expect(next.playerId).toBeNull();
  });

  test("lobby updates the roster and leader, and clears a previous error", () => {
    const withError: OnlineState = { ...initialOnlineState, phase: "lobby", error: "nope" };
    const next = applyServerMessage(withError, {
      type: "lobby",
      participants: [
        { id: "p-0-1", number: 1, color: 0, isBot: false },
        { id: "b-0-2", number: 2, color: 1, isBot: true, difficulty: "hard" },
      ],
      leaderId: "p-0-1",
    });
    expect(next.participants).toHaveLength(2);
    expect(next.participants[1]!.difficulty).toBe("hard");
    expect(next.leaderId).toBe("p-0-1");
    expect(next.error).toBeNull();
  });

  test("a lobby broadcast once racing is ignored: the roster is frozen", () => {
    const racing: OnlineState = { ...initialOnlineState, phase: "racing", participants: [] };
    const next = applyServerMessage(racing, {
      type: "lobby",
      participants: [{ id: "p-0-1", number: 1, color: 0, isBot: false }],
      leaderId: "p-0-1",
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
        colors: { "p-0-1": 4, "b-0-2": 0 },
        countdownMs: 3000,
      },
    );
    expect(next.phase).toBe("countdown");
    expect(next.countdownMs).toBe(3000);
    expect(next.carIds).toEqual(["p-0-1", "b-0-2"]);
    expect(colorIndex(next, "p-0-1")).toBe(4);
  });

  test("in the lobby, a car's colour is its participant's", () => {
    const lobby: OnlineState = {
      ...initialOnlineState,
      phase: "lobby",
      participants: [{ id: "p-0-1", number: 1, color: 6, isBot: false }],
    };
    expect(colorIndex(lobby, "p-0-1")).toBe(6);
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

  test("a busy refusal is remembered, so the visitor is told the server is full", () => {
    const lobby: OnlineState = { ...initialOnlineState, phase: "lobby" };
    expect(
      applyServerMessage(lobby, { type: "error", message: "server busy", code: "busy" }).busy,
    ).toBe(true);
    expect(applyServerMessage(lobby, { type: "error", message: "nope" }).busy).toBe(false);
    const closed = applyServerMessage(
      { ...initialOnlineState, phase: "connecting" },
      { type: "room-closed", busy: true },
    );
    expect(closed).toEqual(expect.objectContaining({ phase: "disconnected", busy: true }));
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
      t: 5,
      c: [],
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

  test("asks for an invite's room in the query", () => {
    expect(apiWsUrl("race42")).toBe("ws://localhost:17100/?room=race42");
  });
});

describe("apiHttpUrl", () => {
  test("is the same server over http, for the wake-up call", () => {
    expect(apiHttpUrl()).toBe("http://localhost:17100");
  });
});

describe("invites", () => {
  test("only the API's own room codes are accepted from a URL", () => {
    expect(isRoomCode("race42")).toBe(true);
    expect(isRoomCode("RACE42")).toBe(false);
    expect(isRoomCode("race4")).toBe(false);
    expect(isRoomCode("rac<e>")).toBe(false);
    expect(isRoomCode(null)).toBe(false);
  });

  test("the invite link is this page in online mode, with the room and nothing else", () => {
    expect(inviteUrl("https://site.dev/pt/projects/racegame?x=1#top", "race42")).toBe(
      "https://site.dev/pt/projects/racegame?mode=online&room=race42",
    );
  });
});
