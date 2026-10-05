import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import { NO_KEYS } from "race-engine/node";
import WebSocket from "ws";
import { GameModule } from "./game.module";

/**
 * Exercises the real WebSocket wiring end to end (the `ws` adapter's message
 * format, the gateway's decorators, two real sockets), rather than the Room
 * logic in isolation (see room.spec.ts).
 */
describe("GameGateway (e2e)", () => {
  let app: INestApplication;
  let url: string;

  // A fresh app (and so a fresh RoomService) per test: otherwise a room left
  // "waiting" by one test could still be open when the next test connects,
  // since a closed socket's disconnect reaches the server asynchronously.
  beforeEach(async () => {
    app = await NestFactory.create(GameModule, new ExpressAdapter(), { logger: false });
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    url = `ws://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  /**
   * The server can write its first message (the "welcome") before the client
   * library gets around to attaching a listener after "open" resolves, so
   * messages are queued from the socket's creation, not from the first await.
   */
  type Msg = Record<string, unknown>;
  /**
   * Every `join()` sends the new client a "welcome", then broadcasts a fresh
   * "lobby" to everyone already in the room — so each connect (yours or
   * anyone else's) queues exactly one more "lobby" for every open socket.
   */
  function connect(): Promise<{ socket: WebSocket; next: () => Promise<Msg> }> {
    const queue: Msg[] = [];
    const waiters: ((msg: Msg) => void)[] = [];

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        const waiter = waiters.shift();
        if (waiter) waiter(msg);
        else queue.push(msg);
      });
      socket.once("open", () =>
        resolve({
          socket,
          next: () =>
            new Promise((res) => {
              const msg = queue.shift();
              if (msg) res(msg);
              else waiters.push(res);
            }),
        }),
      );
      socket.once("error", reject);
    });
  }

  test("a connecting client is welcomed with a server-assigned number", async () => {
    const { socket, next } = await connect();
    const welcome = await next();

    expect(welcome).toEqual(expect.objectContaining({ type: "welcome", number: 1 }));
    socket.close();
  });

  test("two clients share a room; the first in is the leader", async () => {
    const alice = await connect();
    const aliceWelcome = await alice.next();
    await alice.next(); // lobby of just alice, from her own join

    const bob = await connect();
    await bob.next(); // welcome
    const lobby = await alice.next(); // lobby updated with bob in it

    expect(lobby).toEqual(
      expect.objectContaining({
        type: "lobby",
        leaderId: aliceWelcome.playerId,
        participants: expect.arrayContaining([
          expect.objectContaining({ number: 1 }),
          expect.objectContaining({ number: 2 }),
        ]),
      }),
    );
    alice.socket.close();
    bob.socket.close();
  });

  test("sending input doesn't crash the connection before the race starts", async () => {
    const { socket, next } = await connect();
    await next(); // welcome

    socket.send(JSON.stringify({ event: "input", data: NO_KEYS }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(socket.readyState).toBe(WebSocket.OPEN);
    socket.close();
  });

  test("only the leader can add a bot or start; a non-leader gets an error back", async () => {
    const alice = await connect();
    await alice.next(); // welcome
    await alice.next(); // lobby of just alice
    const bob = await connect();
    await bob.next(); // welcome
    await bob.next(); // lobby after his own join
    await alice.next(); // same lobby update, from alice's side

    bob.socket.send(JSON.stringify({ event: "add-bot" }));
    const bobError = await bob.next();
    expect(bobError).toEqual(expect.objectContaining({ type: "error" }));

    alice.socket.send(JSON.stringify({ event: "add-bot" }));
    const lobbyAfterBot = await alice.next();
    expect(lobbyAfterBot).toEqual(
      expect.objectContaining({
        type: "lobby",
        participants: expect.arrayContaining([expect.objectContaining({ isBot: true })]),
      }),
    );

    alice.socket.send(JSON.stringify({ event: "start" }));
    const start = await alice.next();
    expect(start).toEqual(expect.objectContaining({ type: "start" }));

    alice.socket.close();
    bob.socket.close();
  });

  test("the leader can't start alone; the error names the rule", async () => {
    const { socket, next } = await connect();
    await next(); // welcome
    await next(); // lobby of just this one client

    socket.send(JSON.stringify({ event: "start" }));
    const error = await next();

    expect(error).toEqual(
      expect.objectContaining({ type: "error", message: expect.stringContaining("2") }),
    );
    socket.close();
  });
});
