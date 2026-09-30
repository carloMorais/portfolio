import { expect, test } from "@playwright/test";

test.describe("locale detection", () => {
  for (const [browserLocale, expected] of [
    ["pt-BR", "/pt"],
    ["en-US", "/en"],
    ["fr-FR", "/en"],
  ] as const) {
    test(`a ${browserLocale} browser lands on ${expected}`, async ({ browser }) => {
      const context = await browser.newContext({ locale: browserLocale });
      const page = await context.newPage();
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`${expected}$`));
      await context.close();
    });
  }
});

test("switching language keeps the reader on the same page", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("link", { name: "Português" }).click();

  await expect(page).toHaveURL(/\/pt$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Construo produtos web");
});

test("unknown pages show the localized 404", async ({ page }) => {
  const response = await page.goto("/pt/nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});
