import { expect, test, type Page } from "@playwright/test";

async function openNav(page: Page, isMobile: boolean, label: string) {
  if (isMobile) await page.getByRole("button", { name: label }).click();
}

test("the three tabs are pages and mark where the reader is", async ({ page, isMobile }) => {
  await page.goto("/en");
  const nav = page.getByRole("navigation", { name: "Main navigation" });

  for (const [tab, url, heading] of [
    ["Experience", /\/en\/experience$/, "Career"],
    ["Work", /\/en\/work$/, "Real problems, in production."],
    ["Home", /\/en$/, /I build web products/],
  ] as const) {
    await openNav(page, isMobile, "Open menu");
    await nav.getByRole("link", { name: tab, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await openNav(page, isMobile, "Open menu");
    await expect(nav.getByRole("link", { name: tab, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    if (isMobile) await page.getByRole("button", { name: "Close menu" }).click();
  }
});

test("the mobile menu closes after choosing a tab", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/en");
  await page.getByRole("button", { name: "Open menu" }).click();

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();

  await expect(page).toHaveURL(/\/en\/work$/);
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

for (const [locale, file] of [
  ["pt", "/cv/Carlos_Morais_CV_PT.pdf"],
  ["en", "/cv/Carlos_Morais_CV_EN.pdf"],
] as const) {
  test(`resume download matches the ${locale} page and is a PDF`, async ({ page, request }) => {
    await page.goto(`/${locale}`);
    const link = page.locator("a[download]").first();
    await expect(link).toHaveAttribute("href", file);

    const response = await request.get(file);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
  });
}

test("the tab pill slides to the active tab", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop tabs only");
  await page.goto("/en");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const pill = nav.locator('li[aria-hidden="true"]');

  await nav.getByRole("link", { name: "Work", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/work$/);

  const target = nav.getByRole("link", { name: "Work", exact: true });
  await expect(async () => {
    const [p, t] = await Promise.all([pill.boundingBox(), target.boundingBox()]);
    expect(Math.abs(p!.x - t!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(p!.width - t!.width)).toBeLessThanOrEqual(1);
  }).toPass();
});

test("a ready work card opens its case study", async ({ page }) => {
  await page.goto("/pt/work");
  await page.getByRole("link", { name: "RaceGame: corrida multiplayer em tempo real" }).click();

  await expect(page).toHaveURL(/\/pt\/projects\/racegame$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "RaceGame: corrida multiplayer em tempo real",
  );
  for (const section of [
    "Contexto",
    "O problema",
    "Minha parte",
    "Decisões técnicas",
    "Arquitetura",
    "Resultado",
    "A reescrita de 2026",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible();
  }
  await expect(page.getByRole("img", { name: /PostgreSQL/ })).toBeVisible();

  await page.getByRole("article").getByRole("link", { name: "Trabalhos", exact: true }).click();
  await expect(page).toHaveURL(/\/pt\/work$/);
});

test("every work card on Work opens a page with its title", async ({ page }) => {
  await page.goto("/en/work");
  const links = page.locator("[data-work] h2 a");
  const count = await links.count();
  expect(count).toBe(6);
  for (let i = 0; i < count; i++) {
    await page.goto("/en/work");
    const link = page.locator("[data-work] h2 a").nth(i);
    const title = (await link.textContent())!;
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  }
});

test("the old Demos address still lands on the Work tab", async ({ page }) => {
  await page.goto("/pt/demos");
  await expect(page).toHaveURL(/\/pt\/work$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Problemas reais, em produção.");
});
