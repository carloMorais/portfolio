import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

const pages = [
  "/en",
  "/pt",
  "/en/experience",
  "/pt/experience",
  "/en/demos",
  "/pt/demos",
  "/en/projects/racegame",
  "/pt/projects/racegame",
  "/en/projects/renova",
  "/pt/projects/renova",
  "/en/projects/food-point",
  "/pt/projects/food-point",
  ...["plumaa", "omnichannel-ai", "bayer"].flatMap((slug) => [
    `/en/cases/${slug}`,
    `/pt/cases/${slug}`,
  ]),
];

for (const path of pages) {
  test.describe(path, () => {
    test("has no detectable accessibility violations", async ({ page }) => {
      await page.goto(path);
      const axe = new AxeBuilder({ page });
      // The Food Point demo frames the 2024 app unchanged: its markup is a
      // record of that project, not this site's (the page around it is checked).
      if (path.includes("food-point")) axe.exclude("iframe");
      const results = await axe.analyze();
      expect(results.violations).toEqual([]);
    });

    test("does not scroll horizontally", async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("internal links resolve", async ({ page, request }) => {
      await page.goto(path);
      const hrefs = await page
        .locator('a[href^="/"]')
        .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")!))]);
      for (const href of hrefs) {
        const response = await request.get(href);
        expect(response.status(), href).toBeLessThan(400);
      }
    });
  });
}
