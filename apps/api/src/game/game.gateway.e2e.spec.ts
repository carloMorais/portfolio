import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import { NO_KEYS } from "race-engine/node";
import WebSocket from "ws";
import { GameModule } from "./game.module";
import { CLOSE_BUSY, CLOSE_POLICY, MAX_CONNECTIONS_PER_IP, MAX_PAYLOAD_BYTES } from "./limits";

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
  function connect(
    headers: Record<string, string> = {},
  ): Promise<{ socket: WebSocket; next: () => Promise<Msg> }> {
    const queue: Msg[] = [];
    const waiters: ((msg: Msg) => void)[] = [];

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url, { headers });
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

  /** Resolves with the close code the server closed this socket with. */
  const closed = (socket: WebSocket) =>
    new Promise<number>((resolve) => socket.once("close", (code) => resolve(code)));

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

  test("the leader picks the bots' difficulty and everyone's lobby shows it", async () => {
    const { socket, next } = await connect();
    await next(); // welcome
    expect(await next()).toEqual(expect.objectContaining({ difficulty: "normal" }));

    socket.send(JSON.stringify({ event: "difficulty", data: "hard" }));
    expect(await next()).toEqual(expect.objectContaining({ type: "lobby", difficulty: "hard" }));

    socket.send(JSON.stringify({ event: "difficulty", data: "impossible" }));
    expect(await next()).toEqual(expect.objectContaining({ type: "error" }));
    socket.close();
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

  test("ping is echoed as pong, for the client's round-trip measurement", async () => {
    const { socket, next } = await connect();
    await next(); // welcome
    await next(); // lobby
    socket.send(JSON.stringify({ event: "ping", data: 1234.5 }));
    expect(await next()).toEqual({ type: "pong", t: 1234.5 });
    socket.close();
  });

  test("a message over the size limit closes the socket (ws code 1009)", async () => {
    const { socket } = await connect();
    const code = closed(socket);
    socket.send(JSON.stringify({ event: "input", data: { pad: "x".repeat(MAX_PAYLOAD_BYTES) } }));
    expect(await code).toBe(1009);
  });

  test("a socket flooding messages is cut off at once (abnormal close, 1006)", async () => {
    const { socket } = await connect();
    const code = closed(socket);
    const input = JSON.stringify({ event: "input", data: NO_KEYS });
    for (let i = 0; i < 2000 && socket.readyState === WebSocket.OPEN; i++) socket.send(input);
    expect(await code).toBe(1006);
  });

  test("past the per-IP cap, a new socket is turned away as busy", async () => {
    const open = [];
    for (let i = 0; i < MAX_CONNECTIONS_PER_IP; i++) open.push((await connect()).socket);
    const extra = await connect();
    expect(await closed(extra.socket)).toBe(CLOSE_BUSY);
    open.forEach((s) => s.close());
  });

  test("in production, a socket from another site is refused", async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const { socket } = await connect({ origin: "https://evil.example" });
      expect(await closed(socket)).toBe(CLOSE_POLICY);
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});
