import type { IncomingMessage } from "node:http";
import { isAllowedOrigin } from "../origins";
import { MessageBudget, clientIp, sanitizeKeys } from "./limits";

describe("MessageBudget", () => {
  test("a normal client never runs out; a burst is allowed, a flood is dropped then kicked", () => {
    let now = 0;
    const budget = new MessageBudget(() => now);
    // The real client: ~4 inputs + 0.5 pings a second, for a minute.
    for (let i = 0; i < 270; i++) {
      now += 222;
      expect(budget.take()).toBe("ok");
    }
    // A flood from a fresh socket, all within one millisecond: the burst
    // passes, then messages are dropped, then the socket is kicked.
    const flooder = new MessageBudget(() => now);
    const verdicts = Array.from({ length: MessageBudget.BURST + MessageBudget.KICK_DEBT + 2 }, () =>
      flooder.take(),
    );
    expect(verdicts.slice(0, MessageBudget.BURST)).toEqual(
      Array.from({ length: MessageBudget.BURST }, () => "ok"),
    );
    expect(verdicts).toContain("drop");
    expect(verdicts.at(-1)).toBe("kick");
  });
});

describe("sanitizeKeys", () => {
  test("accepts exactly five booleans and nothing else", () => {
    const keys = { up: true, down: false, left: false, right: true, nitro: false };
    expect(sanitizeKeys(keys)).toEqual(keys);
    // Extra fields are dropped, not stored.
    expect(sanitizeKeys({ ...keys, pad: "x".repeat(100) })).toEqual(keys);
    expect(sanitizeKeys({ ...keys, up: "yes" })).toBeNull();
    expect(sanitizeKeys({ up: true })).toBeNull();
    expect(sanitizeKeys(null)).toBeNull();
    expect(sanitizeKeys("up")).toBeNull();
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>, remoteAddress = "10.0.0.1") =>
    ({ headers, socket: { remoteAddress } }) as unknown as IncomingMessage;

  test("behind Render's proxy, the visitor is the entry the proxy appended, the last", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    // A client forging the header can't pick its own identity: the proxy's entry wins.
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(req({}))).toBe("10.0.0.1");
  });
});

describe("isAllowedOrigin", () => {
  const env = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  test("production trusts only the site and its previews", () => {
    process.env.NODE_ENV = "production";
    expect(isAllowedOrigin("https://portfolio-carlomorais.vercel.app")).toBe(true);
    expect(isAllowedOrigin("https://portfolio-git-release-carlo.vercel.app")).toBe(true);
    expect(isAllowedOrigin("http://localhost:17000")).toBe(false);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });

  test("dev also trusts the local 17xxx ports and origin-less test clients", () => {
    process.env.NODE_ENV = "development";
    expect(isAllowedOrigin("http://localhost:17002")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000")).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(true);
  });
});
