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

  beforeAll(async () => {
    app = await NestFactory.create(GameModule, new ExpressAdapter(), { logger: false });
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    url = `ws://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * The server can write its first message (the "welcome") before the client
   * library gets around to attaching a listener after "open" resolves, so
   * messages are queued from the socket's creation, not from the first await.
   */
  function connect(): Promise<{ socket: WebSocket; next: () => Promise<Record<string, unknown>> }> {
    const queue: Record<string, unknown>[] = [];
    const waiters: ((msg: Record<string, unknown>) => void)[] = [];

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

  test("a connecting client is welcomed with a server-assigned name", async () => {
    const { socket, next } = await connect();
    const welcome = await next();

    expect(welcome).toEqual(
      expect.objectContaining({ type: "welcome", name: expect.stringMatching(/^Piloto \d+$/) }),
    );
    socket.close();
  });

  test("two clients share a room and see each other in the roster", async () => {
    const alice = await connect();
    await alice.next(); // welcome

    const bob = await connect();
    await bob.next(); // welcome
    const roster = await alice.next();

    expect(roster).toEqual(
      expect.objectContaining({
        type: "roster",
        names: expect.arrayContaining(["Piloto 1", "Piloto 2"]),
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
});
