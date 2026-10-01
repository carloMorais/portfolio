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

test("touch controls show on phones and stay out of the way on desktop", async ({
  page,
  isMobile,
}) => {
  await page.goto("/en/projects/racegame/play");
  const gas = page.getByRole("button", { name: "Accelerate" });
  if (isMobile) await expect(gas).toBeVisible();
  else await expect(gas).toBeHidden();
});
