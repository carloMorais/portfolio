import { COUNTDOWN_MS, Room, type RoomClient } from "./room";

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
    participants: { id: string; number: number; isBot: boolean }[];
    leaderId: string | null;
    difficulty: string;
  };
}

describe("Room", () => {
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

  test("ticks broadcast state and move the race forward", () => {
    jest.useFakeTimers();
    const room = new Room("r9", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);
    room.startRace(alice);

    jest.advanceTimersByTime(COUNTDOWN_MS + 1000 / 30);

    const states = alice.messages.filter((m) => (m as { type: string }).type === "state");
    expect(states).toHaveLength(1);
    expect((states[0] as { tick: number }).tick).toBe(1);
    jest.useRealTimers();
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

  test("the start lights run before the first tick, and keys held during them count", () => {
    jest.useFakeTimers();
    const room = new Room("r13", jest.fn(), jest.fn());
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    room.startRace(alice);

    const start = alice.messages.find((m) => (m as { type: string }).type === "start");
    expect(start).toEqual(expect.objectContaining({ countdownMs: COUNTDOWN_MS }));
    room.setInput(alice, { up: true, down: false, left: false, right: false, nitro: false });
    jest.advanceTimersByTime(COUNTDOWN_MS - 1);
    expect(alice.messages.some((m) => (m as { type: string }).type === "state")).toBe(false);

    jest.advanceTimersByTime(1000 / 30 + 1);
    const state = alice.messages.find((m) => (m as { type: string }).type === "state") as {
      cars: { id: string; vx: number; checkpoint: number; lapTicks: number[] }[];
      finished: string[];
    };
    const me = state.cars.find(
      (c) => c.id === (alice.messages[0] as { playerId: string }).playerId,
    )!;
    expect(me.vx).not.toBe(0);
    expect(me).toEqual(expect.objectContaining({ checkpoint: 0, lapTicks: [] }));
    expect(state.finished).toEqual([]);
    jest.useRealTimers();
  });

  test("only the leader picks the bots' difficulty, and only a known one", () => {
    const room = new Room("r14", jest.fn(), jest.fn());
    const alice = fakeClient();
    const bob = fakeClient();
    room.join(alice);
    room.join(bob);
    expect(lastLobby(bob).difficulty).toBe("normal");

    expect(room.setDifficulty(bob, "hard")).toEqual({ ok: false, message: expect.any(String) });
    expect(room.setDifficulty(alice, "insane")).toEqual({ ok: false, message: expect.any(String) });
    expect(room.setDifficulty(alice, "hard")).toEqual({ ok: true });
    expect(lastLobby(bob).difficulty).toBe("hard");
  });

  test("once every human is gone the race ends, instead of ticking on for nobody", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    const room = new Room("r15", jest.fn(), onDone);
    const alice = fakeClient();
    room.join(alice);
    room.addBot(alice);
    room.startRace(alice);
    jest.advanceTimersByTime(COUNTDOWN_MS + 100);

    room.leave(alice);

    expect(room.state).toBe("done");
    expect(onDone).toHaveBeenCalledWith(room);
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
});
