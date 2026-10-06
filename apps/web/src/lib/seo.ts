import type { Metadata } from "next";
import { site } from "@/content/site";
import { routing, type Locale } from "@/i18n/routing";

/**
 * The public origin, used for canonical URLs, hreflang, the sitemap and OG
 * tags. NEXT_PUBLIC_SITE_URL overrides it; any Vercel build uses `site.url`
 * (not Vercel's generated domain); anything else is local.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (env.VERCEL) return site.url;
  return "http://localhost:17000";
}

/** hreflang codes for each locale; `x-default` points at the default locale. */
export const hreflang: Record<Locale, string> = { pt: "pt-BR", en: "en" };
const ogLocale: Record<Locale, string> = { pt: "pt_BR", en: "en_US" };

/** Locale-prefixed path: `localePath("pt", "/work")` → `/pt/work`, `("pt", "")` → `/pt`. */
export const localePath = (locale: Locale, path: string) => `/${locale}${path}`;

/** Every indexable page, without the locale prefix ("" is the home page). */
export const indexablePaths = [
  "",
  "/experience",
  "/work",
  "/cases/plumaa",
  "/cases/omnichannel-ai",
  "/cases/bayer",
  "/projects/racegame",
  "/projects/renova",
  "/projects/food-point",
] as const;

export type IndexablePath = (typeof indexablePaths)[number];

/** hreflang alternates for `path`, including x-default. */
export function languageAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(routing.locales.map((l) => [hreflang[l], localePath(l, path)])),
    "x-default": localePath(routing.defaultLocale, path),
  };
}

/**
 * Canonical, hreflang, Open Graph and Twitter tags for one page. Pages must
 * build their metadata through this: `openGraph` is replaced (not merged) by
 * the deepest segment that sets it.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  siteName,
  absolute,
}: {
  locale: Locale;
  path: IndexablePath;
  title: string;
  /** Use the title as-is, without the " · Carlos Morais" template (home page). */
  absolute?: boolean;
  description: string;
  siteName: string;
}): Metadata {
  const url = localePath(locale, path);
  // The generated image lives in app/[locale]/opengraph-image.tsx; it has to be
  // listed here because a page's openGraph replaces the segment's.
  const image = { url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: siteName };
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      url,
      siteName,
      title,
      description,
      locale: ogLocale[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
