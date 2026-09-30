import { expect, test } from "@playwright/test";
import { ageOn } from "../src/lib/age";
import { site } from "../src/content/site";

test.describe("home page extras (desktop)", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("hovering the portrait reveals the name and current age", async ({ page }) => {
    await page.goto("/pt");
    const caption = page.getByText(`Carlos Morais · Full-Stack · ${ageOn(site.birthDate)} anos`);

    await expect(caption).not.toBeInViewport();
    await page.locator('[data-photo-slot="heroPortrait"]').hover();
    await expect(caption).toBeInViewport();
  });

  test("the portrait is exactly as tall as the hero text", async ({ page }) => {
    await page.goto("/en");
    const photo = page.locator('[data-photo-slot="heroPortrait"]');
    const [photoBox, textBox] = await photo.evaluate((el) =>
      [el, el.previousElementSibling!].map((node) => {
        const r = node.getBoundingClientRect();
        return { y: r.y, height: r.height };
      }),
    );
    expect(Math.abs(photoBox.y - textBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(photoBox.height - textBox.height)).toBeLessThanOrEqual(1);
  });

  test("the scroll hint fades out once the reader scrolls", async ({ page }) => {
    await page.goto("/en");
    const hint = page.locator("[data-scroll-hint]");
    await expect(hint).toHaveText("Scroll for more");
    await expect(hint).toHaveCSS("opacity", "1");

    await page.mouse.wheel(0, 600);
    await expect(hint).toHaveCSS("opacity", "0");
  });

  test("the minimap follows the section being read and jumps on click", async ({ page }) => {
    await page.goto("/en");
    const minimap = page.getByRole("navigation", { name: "Page sections" });
    await expect(minimap).toBeVisible();
    await expect(minimap.getByRole("link", { name: "Intro" })).toHaveAttribute(
      "aria-current",
      "location",
    );

    await minimap.hover();
    await minimap.getByRole("link", { name: "Contact" }).click();

    await expect(page).toHaveURL(/#contact$/);
    await expect(minimap.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  test("the minimap only exists on the home page", async ({ page }) => {
    await page.goto("/en/experience");
    await expect(page.locator("[data-minimap]")).toHaveCount(0);
  });

  test("the four graph clusters stay on screen and clear of the content", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en");
    await expect(page.locator("[data-tech-graph]")).toBeVisible();

    const { clusters, obstacles, viewportWidth } = await page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const photo = document.querySelector('[data-photo-slot="heroPortrait"]')!;
      return {
        clusters: [...document.querySelectorAll(".tech-graph-cluster")].map(rect),
        obstacles: [rect(photo), rect(photo.previousElementSibling!)],
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(clusters).toHaveLength(4);
    for (const c of clusters) {
      expect(c.left).toBeGreaterThanOrEqual(0);
      expect(c.right).toBeLessThanOrEqual(viewportWidth);
      for (const o of obstacles) {
        const overlaps =
          c.left < o.right && c.right > o.left && c.top < o.bottom && c.bottom > o.top;
        expect(overlaps).toBe(false);
      }
    }
  });

  test("the user cluster keeps typing different phrases", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en");
    const typed = page.locator("[data-typed]");
    await expect(typed).toBeAttached();

    const seen = new Set<string>();
    await expect(async () => {
      seen.add((await typed.textContent()) ?? "");
      expect(seen.size).toBeGreaterThan(3);
    }).toPass({ timeout: 10_000, intervals: [250] });
  });
});
