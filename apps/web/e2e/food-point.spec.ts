import { expect, test, type Page } from "@playwright/test";

// The 2024 app formats dates with the browser's locale, as Brazilian users had it.
test.use({ locale: "pt-BR" });

// OpenStreetMap is someone else's: the map tiles and the reverse geocoding get
// stand-ins, so CI never depends on them (Leaflet itself still loads from unpkg).
async function fakeMaps(page: Page) {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await page.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      json: { address: { road: "Rua Teste", city: "São José dos Campos", state: "São Paulo" } },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
}

async function open(page: Page) {
  await fakeMaps(page);
  await page.goto("/pt/projects/food-point");
  return page.frameLocator('iframe[title="Food Point, o app de 2024"]');
}

const log = (page: Page) => page.getByRole("list", { name: "Requisições à API" });

test("the 2024 app logs in and creates an event against the simulated server", async ({ page }) => {
  const app = await open(page);

  await app.getByText("login", { exact: true }).click();
  await app.locator("#email-login").fill("visitante@foodpoint.com");
  await app.locator("#password-login").fill("foodpoint2024");
  await app.locator("#loginPage-btn").click();
  await expect(app.getByText("Meus eventos")).toBeVisible();
  await expect(app.getByText(/^Noite ital/)).toBeVisible();
  await expect(page.locator("[data-app-path]")).toHaveText(/\/home$/);

  // Details → menu → place → guests.
  await app.locator("#homeBtnNewEvent").click();
  await app.locator("#newEvent-basic-name").fill("Churrasco");
  const date = new Date();
  date.setDate(date.getDate() + 10);
  await app.locator("#newEvent-basic-date").fill(date.toISOString().slice(0, 10));
  await app.locator("#newEvent-basic-time").fill("12:30");
  // The 2024 form re-checks on blur and moves the button; leave the field before clicking.
  await app.locator("#newEvent-basic-time").blur();
  await app.getByText("Salvar e Continuar").click();
  await expect(page.locator("[data-app-path]")).toHaveText(/\/home\/create\/menu$/);

  await app.getByPlaceholder("Pão com gergelim").fill("Picanha");
  await app.getByText("Adicionar ingrediente").click();
  await app.getByPlaceholder("trigo").fill("Picanha");
  await app.locator('select[name="unity-of-measurement"]').selectOption("Gramas (g)");
  await app.locator('input[type="number"]').fill("1200");
  await app.getByText("Salvar prato").click();
  await expect(log(page)).toContainText("/dish");
  await app.locator("#a-menu-page").click();

  const map = app.locator("#newEventLocal-map");
  await expect(map.locator(".leaflet-pane").first()).toBeAttached();
  await map.click({ position: { x: 200, y: 120 } });
  await app.getByText("Salvar e continuar").click();

  await app.locator("#add-input").fill("Diego");
  await app.locator("#add-button").click();
  await expect(app.getByText("Diego")).toBeVisible();

  const requests = log(page);
  await expect(requests).toContainText("POST/api/event");
  await expect(requests).toContainText("/basic-infos");
  await expect(requests).toContainText("/location");
  await expect(requests).toContainText("POST/api/guest/");

  // The data stays in the browser, with the session (the 2024 cookie lasted 8 hours).
  const saved = () => page.evaluate(() => localStorage.getItem("foodpoint-demo:db:v1") ?? "");
  await page.reload();
  expect(await saved()).toContain("Churrasco");
  await page.frameLocator("iframe").locator("body").waitFor();

  // "Reset data" goes back to the sample event only.
  await page.getByRole("button", { name: "Restaurar dados" }).click();
  await expect(log(page)).toContainText("Nenhuma requisição ainda");
  expect(await saved()).not.toContain("Churrasco");
  expect(await saved()).toContain("Noite italiana");
});

test("password recovery shows the code instead of e-mailing it, and the code works", async ({
  page,
}) => {
  const app = await open(page);
  await app.getByText("login", { exact: true }).click();
  await app.getByText("Esqueceu sua senha?").click();
  await app.locator("#input-email-recover-pass").fill("visitante@foodpoint.com");
  await app.getByRole("button", { name: "Enviar" }).click();

  const mail = page.getByText("E-mail que o servidor enviaria").locator("..");
  await expect(mail).toBeVisible();
  const code = (await mail.locator("p.font-mono").innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  await page.getByRole("button", { name: "Abrir o link do e-mail" }).click();
  await expect(page.locator("[data-app-path]")).toHaveText(/\/forget-password$/);
  await app.locator("#input-code").fill(code);
  await app.locator('input[type="password"]').first().fill("novasenha1");
  await app.getByRole("button", { name: "Confirmar" }).click();
  await expect(log(page)).toContainText("PUT/api/recover-pass");
  await expect(log(page).locator("li", { hasText: "PUT/api/recover-pass" })).toContainText("200");
});

test("opening the app file on its own sends you to the case study", async ({ page }) => {
  await page.goto("/food-point-demo/index.html");
  await expect(page).toHaveURL(/\/(pt|en)\/projects\/food-point$/);
});
