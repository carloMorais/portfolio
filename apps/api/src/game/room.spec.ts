import { Room, type RoomClient } from "./room";

function fakeClient(): RoomClient & { messages: unknown[] } {
  const messages: unknown[] = [];
  return {
    messages,
    send(data: string) {
      messages.push(JSON.parse(data));
    },
  };
}

describe("Room", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("the first join gets Piloto 1 and the room waits before starting", () => {
    const onEmpty = jest.fn();
    const onDone = jest.fn();
    const room = new Room("r1", onEmpty, onDone, 1_000);
    const alice = fakeClient();

    room.join(alice);

    const welcome = alice.messages[0] as { type: string; name: string };
    expect(welcome).toEqual(
      expect.objectContaining({ type: "welcome", name: "Piloto 1", roomId: "r1" }),
    );
    expect(room.state).toBe("waiting");
  });

  test("a second joiner gets the next name, both see the roster", () => {
    const room = new Room("r2", jest.fn(), jest.fn(), 1_000);
    const alice = fakeClient();
    const bob = fakeClient();

    room.join(alice);
    room.join(bob);

    expect((bob.messages[0] as { name: string }).name).toBe("Piloto 2");
    const roster = alice.messages.at(-1) as { type: string; names: string[] };
    expect(roster).toEqual(
      expect.objectContaining({ type: "roster", names: ["Piloto 1", "Piloto 2"] }),
    );
  });

  test("after the wait window, bots fill the room up to 4 and the race starts", () => {
    const room = new Room("r3", jest.fn(), jest.fn(), 1_000);
    const alice = fakeClient();
    room.join(alice);

    jest.advanceTimersByTime(1_000);

    expect(room.state).toBe("racing");
    const start = alice.messages.find((m) => (m as { type: string }).type === "start") as {
      carIds: string[];
      names: Record<string, string>;
    };
    expect(start.carIds).toHaveLength(4);
    expect(Object.values(start.names)).toEqual(["Piloto 1", "Piloto 2", "Piloto 3", "Piloto 4"]);
  });

  test("enough humans joining skips the wait and starts without bots", () => {
    const room = new Room("r4", jest.fn(), jest.fn(), 60_000);
    const clients = Array.from({ length: 4 }, fakeClient);
    for (const c of clients) room.join(c);

    expect(room.state).toBe("waiting");
  });

  test("filling the room to capacity starts immediately", () => {
    const room = new Room("r5", jest.fn(), jest.fn(), 60_000);
    const clients = Array.from({ length: 10 }, fakeClient);
    for (const c of clients) room.join(c);

    expect(room.state).toBe("racing");
  });

  test("ticks broadcast state and move the race forward", () => {
    const room = new Room("r6", jest.fn(), jest.fn(), 1_000);
    const alice = fakeClient();
    room.join(alice);
    jest.advanceTimersByTime(1_000); // start()

    jest.advanceTimersByTime(1000 / 30);

    const states = alice.messages.filter((m) => (m as { type: string }).type === "state");
    expect(states).toHaveLength(1);
    expect((states[0] as { tick: number }).tick).toBe(1);
  });

  test("the last human leaving an unstarted room tells the manager it's empty", () => {
    const onEmpty = jest.fn();
    const room = new Room("r7", onEmpty, jest.fn(), 1_000);
    const alice = fakeClient();
    room.join(alice);

    room.leave(alice);

    expect(onEmpty).toHaveBeenCalledWith(room);
  });

  test("a player leaving mid-race stops reading its input instead of removing the car", () => {
    const room = new Room("r8", jest.fn(), jest.fn(), 1_000);
    const alice = fakeClient();
    room.join(alice);
    jest.advanceTimersByTime(1_000);

    expect(() => room.leave(alice)).not.toThrow();
    expect(room.state).toBe("racing");
  });
});
