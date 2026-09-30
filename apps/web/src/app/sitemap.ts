import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { indexablePaths, languageAlternates, localePath, siteUrl } from "@/lib/seo";

/** One entry per page and locale, each listing its translations (hreflang). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const absolute = (languages: Record<string, string>) =>
    Object.fromEntries(Object.entries(languages).map(([lang, path]) => [lang, base + path]));

  return indexablePaths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: base + localePath(locale, path),
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.8,
      alternates: { languages: absolute(languageAlternates(path)) },
    })),
  );
}
