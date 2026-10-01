import { expect, test } from "@playwright/test";
import { indexablePaths } from "../src/lib/seo";

// Desktop is enough: the head is the same on every viewport.
test.skip(({ isMobile }) => isMobile, "head tags do not depend on the viewport");

for (const path of indexablePaths) {
  for (const locale of ["pt", "en"] as const) {
    const url = `/${locale}${path}`;
    test(`${url} declares canonical, hreflang and a preview image`, async ({ page }) => {
      await page.goto(url);
      const head = page.locator("head");
      await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`${url}$`),
      );
      for (const [lang, target] of [
        ["pt-BR", `/pt${path}`],
        ["en", `/en${path}`],
        ["x-default", `/en${path}`],
      ]) {
        await expect(head.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveAttribute(
          "href",
          new RegExp(`${target}$`),
        );
      }
      await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        new RegExp(`/${locale}/opengraph-image`),
      );
      await expect(head.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
    });
  }
}

test("the sitemap lists every page in both languages", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const path of indexablePaths) {
    for (const locale of ["pt", "en"]) {
      expect(xml).toContain(`/${locale}${path}</loc>`);
    }
  }
});

test("robots.txt allows crawling and points at the sitemap", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
});

for (const locale of ["pt", "en"]) {
  test(`the ${locale} preview image is a PNG`, async ({ request }) => {
    const response = await request.get(`/${locale}/opengraph-image`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });
}

test("the home page keeps the Search Console verification tag", async ({ page }) => {
  await page.goto("/pt");
  await expect(page.locator('head meta[name="google-site-verification"]')).toHaveAttribute(
    "content",
    "6t6CvcfIJsfkaNk3qF6KyrFaYSeVa1h7iKZXLpjd3Ac",
  );
});

test("the home page describes its owner as structured data", async ({ page }) => {
  await page.goto("/en");
  const json = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent())!,
  );
  expect(json).toMatchObject({ "@type": "Person", name: "Carlos Eduardo Araujo Morais" });
});
