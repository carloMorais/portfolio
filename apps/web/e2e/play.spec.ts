import { expect, test } from "@playwright/test";

const GAME = "/en/projects/racegame";
const game = (page: import("@playwright/test").Page) => page.locator("[data-phase]");
const playerX = async (page: import("@playwright/test").Page) =>
  Number(await game(page).getAttribute("data-player-x"));

test("the game is playable right on the RaceGame page, its card centred on the track", async ({
  page,
}) => {
  await page.goto("/pt/projects/racegame");
  const track = page.getByRole("img", { name: /Pista vista de cima/ });
  await expect(track).toBeVisible();
  const card = page.locator("div.rounded-2xl", {
    has: page.getByRole("button", { name: "Começar corrida" }),
  });
  const centre = async () => {
    const [t, c] = await Promise.all([track.boundingBox(), card.first().boundingBox()]);
    return Math.round(c!.y + c!.height / 2 - (t!.y + t!.height / 2));
  };
  // Centred on the track, and it stays put when the page scrolls.
  expect(Math.abs(await centre())).toBeLessThanOrEqual(2);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(200);
  expect(Math.abs(await centre())).toBeLessThanOrEqual(2);
});

test("the old /play address opens the RaceGame page", async ({ page }) => {
  await page.goto("/pt/projects/racegame/play");
  await expect(page).toHaveURL(/\/pt\/projects\/racegame$/);
  await expect(game(page)).toHaveAttribute("data-phase", "ready");
});

test("a race counts down, then the car answers the throttle", async ({ page, isMobile }) => {
  await page.goto(GAME);
  await expect(game(page)).toHaveAttribute("data-phase", "ready");
  await page.getByRole("button", { name: "Start race" }).click();
  await expect(game(page)).toHaveAttribute("data-phase", "countdown");
  await expect(game(page)).toHaveAttribute("data-phase", "racing", { timeout: 5000 });

  const start = await playerX(page);
  if (isMobile) {
    // Phones accelerate for you by default: the car pulls away on its own.
    await page.waitForTimeout(1200);
  } else {
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(1200);
    await page.keyboard.up("ArrowUp");
  }
  // At rotation 0 the throttle drives left, towards the finish line.
  await expect.poll(() => playerX(page)).toBeLessThan(start - 20);
  expect(Number(await game(page).getAttribute("data-tick"))).toBeGreaterThan(20);
});

test("during a race, a live board ranks every driver beside lap and time", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "phones get the one-line HUD instead (next test)");
  await page.goto(GAME);
  const board = page.getByRole("table", { name: "Standings" });
  // Standings, times and records only show once there's a race.
  await expect(board).toBeHidden();
  await expect(page.getByText("Lap", { exact: true })).toBeHidden();
  await expect(page.getByText("Best race", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Start race" }).click();
  await expect(board.locator("tbody tr")).toHaveCount(4);
  await expect(board).toContainText("You");
  await expect(board.getByRole("img", { name: "no nitro" })).toHaveCount(4);
  await expect(page.getByText("Lap", { exact: true })).toBeVisible();
});

test("on phones, a race shows place, lap and time on one line", async ({ page, isMobile }) => {
  test.skip(!isMobile, "desktop keeps the full panels");
  await page.goto(GAME);
  await expect(page.getByRole("table", { name: "Standings" })).toBeHidden();
  await page.getByRole("button", { name: "Start race" }).click();
  await expect(page.getByText(/^Pos\. \d\/4$/)).toBeVisible();
  await expect(page.getByRole("table", { name: "Standings" })).toBeHidden();
});

test("controls are drawn as keys on desktop", async ({ page, isMobile }) => {
  await page.goto(GAME);
  // One legend per breakpoint is in the page; only the visible one counts.
  const space = page.locator("kbd", { hasText: "Space" }).filter({ visible: true });
  await expect(space).toHaveCount(isMobile ? 0 : 1);
});

test("touch controls show on phones and stay out of the way on desktop", async ({
  page,
  isMobile,
}) => {
  await page.goto(GAME);
  const gas = page.getByRole("button", { name: "Accelerate", exact: true });
  const steer = page.getByRole("button", { name: "Left", exact: true });
  const autoGas = page.getByRole("checkbox", { name: "Accelerate for me" });
  if (isMobile) {
    // Accelerating is automatic on phones by default; turning it off brings the button back.
    await expect(steer).toBeVisible();
    await expect(autoGas).toBeChecked();
    await expect(gas).toBeHidden();
    await autoGas.uncheck();
    await expect(gas).toBeVisible();
  } else {
    await expect(steer).toBeHidden();
    await expect(autoGas).toBeHidden();
  }
});

test("the keyboard starts, pauses, resumes and restarts the race", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcuts are for desktop");
  await page.goto(GAME);
  await page.keyboard.press("Enter");
  await expect(game(page)).toHaveAttribute("data-phase", "racing", { timeout: 5000 });

  await page.keyboard.press("Escape");
  await expect(game(page)).toHaveAttribute("data-phase", "paused");
  await page.waitForTimeout(250); // the HUD refreshes every 100 ms: let it settle
  const frozen = await game(page).getAttribute("data-tick");
  await page.waitForTimeout(500);
  await expect(game(page)).toHaveAttribute("data-tick", frozen!);
  await page.keyboard.press("Escape");
  await expect(game(page)).toHaveAttribute("data-phase", "racing");

  await page.keyboard.press("KeyR");
  await expect(game(page)).toHaveAttribute("data-phase", "countdown");
});

test("the difficulty is remembered in this browser", async ({ page }) => {
  await page.goto(GAME);
  const hard = page.getByRole("button", { name: "Hard" });
  await expect(page.getByRole("button", { name: "Normal" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await hard.click();
  await expect(hard).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");
});

test("a pause button on the track pauses the race at any time", async ({ page }) => {
  await page.goto(GAME);
  // The game's own button (the 2024 clip further down has one too).
  const pause = game(page).getByRole("button", { name: "Pause" });
  await expect(pause).toBeHidden();
  await page.getByRole("button", { name: "Start race" }).click();
  await expect(game(page)).toHaveAttribute("data-phase", "racing", { timeout: 5000 });
  await pause.click();
  await expect(game(page)).toHaveAttribute("data-phase", "paused");
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(game(page)).toHaveAttribute("data-phase", "racing");
});

test("an invite link opens online mode", async ({ page }) => {
  await page.goto(`${GAME}?mode=online&room=race42`);
  await expect(page.getByRole("button", { name: "Online" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Back to practice: the invite leaves the address bar.
  await page.getByRole("button", { name: "Practice" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/racegame$/);
  await expect(game(page)).toHaveAttribute("data-phase", "ready");
});

test("time trial races you alone against the clock, with the medals beside the track", async ({
  page,
  isMobile,
}) => {
  await page.goto(GAME);
  await page.getByRole("button", { name: "Time trial" }).click();
  await expect(page.getByText("Medals").first()).toBeVisible();
  await expect(page.getByRole("group", { name: "Difficulty" })).toHaveCount(0);
  await page.getByRole("button", { name: "Start race" }).click();
  await expect(game(page)).toHaveAttribute("data-phase", "racing", { timeout: 5000 });
  // No bots: the standings never show up, the medals do (desktop).
  await expect(page.getByRole("table", { name: "Standings" })).toBeHidden();
  if (!isMobile) await expect(page.getByText("Gold", { exact: true })).toBeVisible();
});

test("sitting still after the start shows how to accelerate", async ({ page, isMobile }) => {
  test.skip(isMobile, "phones accelerate on their own by default");
  await page.goto(GAME);
  await page.getByRole("button", { name: "Start race" }).click();
  await expect(game(page)).toHaveAttribute("data-phase", "racing", { timeout: 5000 });
  await expect(page.getByText("Hold ↑ or W to accelerate")).toBeVisible({ timeout: 4000 });
});
