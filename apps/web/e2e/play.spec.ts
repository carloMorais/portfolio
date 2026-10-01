import { expect, test } from "@playwright/test";

const game = (page: import("@playwright/test").Page) => page.locator("[data-phase]");
const playerX = async (page: import("@playwright/test").Page) =>
  Number(await game(page).getAttribute("data-player-x"));

test("the case study links to the playable practice mode", async ({ page }) => {
  await page.goto("/pt/projects/racegame");
  await page.getByRole("link", { name: "Jogar no navegador" }).click();
  await expect(page).toHaveURL(/\/pt\/projects\/racegame\/play$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modo treino");
  await expect(page.getByRole("img", { name: /Pista vista de cima/ })).toBeVisible();
});

test("a race counts down, then the car answers the throttle", async ({ page, isMobile }) => {
  await page.goto("/en/projects/racegame/play");
  await expect(game(page)).toHaveAttribute("data-phase", "ready");
  await page.getByRole("button", { name: "Start race" }).click();
  await expect(game(page)).toHaveAttribute("data-phase", "countdown");
  await expect(game(page)).toHaveAttribute("data-phase", "racing", { timeout: 5000 });

  const start = await playerX(page);
  if (isMobile) {
    // Hold the on-screen accelerator.
    const gas = page.getByRole("button", { name: "Accelerate" });
    await gas.hover();
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
  } else {
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(1200);
    await page.keyboard.up("ArrowUp");
  }
  // At rotation 0 the throttle drives left, towards the finish line.
  await expect.poll(() => playerX(page)).toBeLessThan(start - 20);
  expect(Number(await game(page).getAttribute("data-tick"))).toBeGreaterThan(20);
});

test("a live board ranks every driver with their nitro, beside lap and time", async ({ page }) => {
  await page.goto("/en/projects/racegame/play");
  const board = page.getByRole("table", { name: "Standings" });
  await expect(board.locator("tbody tr")).toHaveCount(4);
  await expect(board).toContainText("You");
  await expect(board.getByRole("img", { name: "no nitro" })).toHaveCount(4);
  await expect(page.getByText("Lap", { exact: true })).toBeVisible();
});

test("controls are drawn as keys on desktop", async ({ page, isMobile }) => {
  await page.goto("/en/projects/racegame/play");
  const space = page.locator("kbd", { hasText: "Space" });
  if (isMobile) await expect(space).toBeHidden();
  else await expect(space).toBeVisible();
});

test("touch controls show on phones and stay out of the way on desktop", async ({
  page,
  isMobile,
}) => {
  await page.goto("/en/projects/racegame/play");
  const gas = page.getByRole("button", { name: "Accelerate" });
  if (isMobile) await expect(gas).toBeVisible();
  else await expect(gas).toBeHidden();
});

test("the keyboard starts, pauses, resumes and restarts the race", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcuts are for desktop");
  await page.goto("/en/projects/racegame/play");
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
  await page.goto("/en/projects/racegame/play");
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
  await page.goto("/en/projects/racegame/play");
  const pause = page.getByRole("button", { name: "Pause" });
  await expect(pause).toBeHidden();
  await page.getByRole("button", { name: "Start race" }).click();
  await expect(game(page)).toHaveAttribute("data-phase", "racing", { timeout: 5000 });
  await pause.click();
  await expect(game(page)).toHaveAttribute("data-phase", "paused");
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(game(page)).toHaveAttribute("data-phase", "racing");
});
