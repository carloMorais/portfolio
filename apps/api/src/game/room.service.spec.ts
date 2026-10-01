import { NO_KEYS } from "race-engine/node";
import { RoomService } from "./room.service";
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
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

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
});
