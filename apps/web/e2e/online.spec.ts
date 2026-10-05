import { expect, test, type Page } from "@playwright/test";

/**
 * The online mode against a real API (`apps/api`, started by
 * playwright.config.ts on 17101). The API allows 4 sockets per IP and 4 racing
 * rooms, and every test here comes from the same IP: the tests run one at a
 * time, only on desktop, each in a room of its own (an invite code nobody
 * else uses opens a room with that code).
 */
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "one run is enough: the server limits sockets per IP");

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const roomCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
const invite = (room: string) => `/en/projects/racegame?mode=online&room=${room}`;

const game = (page: Page) => page.locator("[data-phase]");
const phase = (page: Page) => game(page).getAttribute("data-phase");
const playerX = async (page: Page) => Number(await game(page).getAttribute("data-player-x"));

/** The lobby and banners exist twice (on the track, and below it on phones): the one on screen. */
const visibleText = (page: Page, text: string) => page.getByText(text).filter({ visible: true });

async function inLobby(page: Page, room: string) {
  await page.goto(invite(room));
  await expect(game(page)).toHaveAttribute("data-phase", "lobby", { timeout: 20_000 });
}

test("alone you can't start; with a bot you can, and your car answers the throttle", async ({
  page,
}) => {
  await inLobby(page, roomCode());
  const start = page.getByRole("button", { name: "Start race" });
  await expect(start).toBeDisabled();
  await expect(visibleText(page, "Needs at least 2 players to start")).toBeVisible();

  await page.getByRole("button", { name: "Add a bot" }).click();
  await expect(start).toBeEnabled();
  await start.click();
  await expect(game(page)).toHaveAttribute("data-phase", "countdown");
  await expect(game(page)).toHaveAttribute("data-phase", "racing", { timeout: 6000 });

  const from = await playerX(page);
  await page.keyboard.down("ArrowUp");
  // At rotation 0 the throttle drives left, towards the finish line.
  await expect.poll(() => playerX(page), { timeout: 5000 }).toBeLessThan(from - 20);
  await page.keyboard.up("ArrowUp");
});

test("an invite brings a friend into your room; mid-race it lets others watch, and a reload takes your car back", async ({
  browser,
}) => {
  const room = roomCode();
  const leader = await (await browser.newContext()).newPage();
  const friend = await (await browser.newContext()).newPage();
  await inLobby(leader, room);
  await inLobby(friend, room);

  // Two humans: the first one in leads; the other waits for them.
  await expect(leader.getByText("Leader", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(visibleText(friend, "Waiting for the leader to start the race.")).toBeVisible();
  await expect(friend.getByRole("button", { name: "Start race" })).toHaveCount(0);
  await leader.getByRole("button", { name: "Start race" }).click();
  for (const p of [leader, friend]) {
    await expect(game(p)).toHaveAttribute("data-phase", "racing", { timeout: 8000 });
  }

  // The same invite, once the race is under way: you watch it.
  const watcher = await (await browser.newContext()).newPage();
  await watcher.goto(invite(room));
  await expect(visibleText(watcher, "Watching: the race had already started")).toBeVisible({
    timeout: 20_000,
  });

  // Reloading mid-race comes back to the same car, still racing (not watching).
  const grid = await playerX(leader);
  await leader.keyboard.down("ArrowUp");
  await expect.poll(() => playerX(leader), { timeout: 5000 }).toBeLessThan(grid - 20);
  await leader.keyboard.up("ArrowUp");
  await leader.reload();
  await expect.poll(() => phase(leader), { timeout: 20_000 }).toBe("racing");
  await expect(visibleText(leader, "Watching: the race had already started")).toHaveCount(0);
  await expect.poll(() => playerX(leader), { timeout: 5000 }).toBeLessThan(grid - 20);

  await Promise.all([leader, friend, watcher].map((p) => p.context().close()));
});
