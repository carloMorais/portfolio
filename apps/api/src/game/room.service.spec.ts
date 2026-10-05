import { NO_KEYS } from "race-engine/node";
import { MAX_RACING_ROOMS } from "./limits";
import { RoomService, isRoomCode } from "./room.service";
import type { RoomClient } from "./room";

function fakeClient(): RoomClient & { messages: unknown[] } {
  const messages: unknown[] = [];
  return {
    messages,
    send(data: string) {
      messages.push(JSON.parse(data));
    },
  };
}

describe("RoomService", () => {
  test("two joins in a row land in the same open room", () => {
    const service = new RoomService();
    const alice = fakeClient();
    const bob = fakeClient();

    service.join(alice);
    service.join(bob);

    expect(service.roomCount).toBe(1);
    expect((alice.messages[0] as { roomId: string }).roomId).toBe(
      (bob.messages[0] as { roomId: string }).roomId,
    );
  });

  const roomId = (client: { messages: unknown[] }) =>
    (client.messages[0] as { roomId: string }).roomId;

  test("rooms get short, readable codes", () => {
    const service = new RoomService();
    const alice = fakeClient();
    service.join(alice);
    expect(isRoomCode(roomId(alice))).toBe(true);
    expect(isRoomCode("ABC123")).toBe(false);
    expect(isRoomCode("../etc")).toBe(false);
  });

  test("an invite code joins that room, even with another one open", () => {
    const service = new RoomService();
    const stranger = fakeClient();
    service.join(stranger); // an open room nobody invited us to
    const alice = fakeClient();
    const bob = fakeClient();

    service.join(alice, "race42");
    service.join(bob, "race42");

    expect(roomId(alice)).toBe("race42");
    expect(roomId(bob)).toBe("race42");
    expect(roomId(stranger)).not.toBe("race42");
  });

  test("an invite to a room that's already racing falls back to matchmaking", () => {
    jest.useFakeTimers();
    const service = new RoomService();
    const alice = fakeClient();
    service.join(alice, "race42");
    service.addBot(alice);
    service.startRace(alice);
    const late = fakeClient();

    service.join(late, "race42");

    expect(roomId(late)).not.toBe("race42");
    jest.useRealTimers();
  });

  test("a malformed code is ignored", () => {
    const service = new RoomService();
    const alice = fakeClient();
    service.join(alice, "not a code");
    expect(roomId(alice)).not.toBe("not a code");
    expect(isRoomCode(roomId(alice))).toBe(true);
  });

  test("leaving before the race starts frees the room", () => {
    const service = new RoomService();
    const alice = fakeClient();

    service.join(alice);
    service.leave(alice);

    expect(service.roomCount).toBe(0);
  });

  test("input from an unknown client is ignored, not thrown", () => {
    const service = new RoomService();
    expect(() => service.input(fakeClient(), NO_KEYS)).not.toThrow();
  });

  test("add-bot/remove-bot/start from an unknown client return nothing, not throw", () => {
    const service = new RoomService();
    const stranger = fakeClient();
    expect(() => {
      service.addBot(stranger);
      service.removeBot(stranger);
      service.startRace(stranger);
    }).not.toThrow();
    expect(service.addBot(stranger)).toBeUndefined();
  });

  test("the leader can add a bot and then start with just the two", () => {
    const service = new RoomService();
    const alice = fakeClient();
    service.join(alice);

    expect(service.addBot(alice)).toEqual({ ok: true });
    expect(service.startRace(alice)).toEqual({ ok: true });
  });
  test("past MAX_RACING_ROOMS races at once, starting another is refused as busy", () => {
    jest.useFakeTimers();
    const service = new RoomService();
    // Each leader starts before the next one connects (a waiting room takes the next joiner).
    const results = Array.from({ length: MAX_RACING_ROOMS + 1 }, () => {
      const leader = fakeClient();
      service.join(leader);
      service.addBot(leader);
      return service.startRace(leader);
    });

    expect(results.slice(0, MAX_RACING_ROOMS)).toEqual(
      Array.from({ length: MAX_RACING_ROOMS }, () => ({ ok: true })),
    );
    expect(results.at(-1)).toEqual(expect.objectContaining({ ok: false, code: "busy" }));
    jest.useRealTimers();
  });
});
