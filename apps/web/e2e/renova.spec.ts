import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The FIPE API is someone else's (and rate-limited): the demo talks to a
// stand-in with the same shapes, so CI never depends on it.
const API = "https://parallelum.com.br/fipe/api/v1/carros";
const answers: Record<string, unknown> = {
  "/marcas": [
    { codigo: "21", nome: "Fiat" },
    { codigo: "59", nome: "VW - VolksWagen" },
  ],
  "/marcas/21/modelos": {
    modelos: [
      { codigo: 4828, nome: "Palio 1.0 ECONOMY Fire Flex 8V 4p" },
      { codigo: 437, nome: "147 C/ CL" },
    ],
    anos: [],
  },
  "/marcas/21/modelos/4828/anos": [
    { codigo: "32000-5", nome: "32000 Flex" },
    { codigo: "2012-5", nome: "2012 Flex" },
  ],
  "/marcas/21/modelos/4828/anos/2012-5": {
    TipoVeiculo: 1,
    Valor: "R$ 29.118,00",
    Marca: "Fiat",
    Modelo: "Palio 1.0 ECONOMY Fire Flex 8V 4p",
    AnoModelo: 2012,
    Combustivel: "Flex",
    CodigoFipe: "001267-0",
    MesReferencia: "outubro de 2026",
    SiglaCombustivel: "F",
  },
};

async function fakeFipe(page: Page, failFirst = false) {
  let failed = !failFirst;
  await page.route(`${API}/**`, async (route) => {
    if (!failed) {
      failed = true;
      return route.fulfill({ status: 429, body: "Too Many Requests" });
    }
    const path = new URL(route.request().url()).pathname.replace("/fipe/api/v1/carros", "");
    const body = answers[path];
    return body
      ? route.fulfill({ json: body, headers: { "access-control-allow-origin": "*" } })
      : route.fulfill({ status: 404, json: { error: "not found" } });
  });
}

test("the Renova demo runs a lookup end to end, showing each tool call", async ({ page }) => {
  await fakeFipe(page);
  await page.goto("/pt/projects/renova");

  await page.getByRole("button", { name: "Carro", exact: true }).click();
  await expect(page.getByText("Encontrei 2 marcas de carros na tabela.")).toBeVisible();
  await page.getByRole("searchbox").fill("fiat");
  await page.getByRole("button", { name: "Fiat", exact: true }).click();
  await page.getByRole("button", { name: "Palio 1.0 ECONOMY Fire Flex 8V 4p" }).click();
  // The 32000 "brand-new" year is hidden, as in the original prompt.
  await expect(page.getByText(/a tabela tem 1 ano\./)).toBeVisible();
  await page.getByRole("button", { name: "2012 Flex" }).click();

  await expect(page.getByText("R$ 29.118,00", { exact: true })).toBeVisible();
  const calls = page.locator("aside li");
  await expect(calls).toHaveCount(4);
  for (const [i, name] of ["getMarcas", "getModelos", "getAnos", "getValor"].entries()) {
    await expect(calls.nth(i)).toContainText(name);
  }
  await expect(calls.nth(3)).toContainText('ano: "2012-5"');

  await page.getByRole("button", { name: "Nova consulta" }).click();
  await expect(page.getByRole("button", { name: "Moto", exact: true })).toBeVisible();
});

test("a failed call says so, in the tool's words, and can be retried", async ({ page }) => {
  await fakeFipe(page, true);
  await page.goto("/en/projects/renova");
  await page.getByRole("button", { name: "Car", exact: true }).click();
  await expect(page.getByText(/didn’t answer just now/)).toBeVisible();
  await expect(page.locator("aside li").first()).toContainText(
    "Error: Failed to fetch vehicle brands",
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("I found 2 car brands in the table.")).toBeVisible();
});

test.describe("after a lookup", () => {
  test.use({ reducedMotion: "reduce" });

  test("has no detectable accessibility violations", async ({ page }) => {
    await fakeFipe(page);
    await page.goto("/en/projects/renova");
    await page.getByRole("button", { name: "Car", exact: true }).click();
    await page.getByRole("button", { name: "Fiat", exact: true }).click();
    await page.getByRole("button", { name: "Palio 1.0 ECONOMY Fire Flex 8V 4p" }).click();
    await page.getByRole("button", { name: "2012 Flex" }).click();
    await expect(page.getByText("R$ 29.118,00", { exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
