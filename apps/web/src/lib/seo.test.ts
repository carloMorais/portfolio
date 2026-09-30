import { work } from "@/content/work";
import { indexablePaths, languageAlternates, pageMetadata, siteUrl } from "./seo";

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, without a trailing slash", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://carlos.vercel.app/" })).toBe(
      "https://carlos.vercel.app",
    );
  });

  it("falls back to the Vercel production domain, then localhost", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "carlos.vercel.app" })).toBe(
      "https://carlos.vercel.app",
    );
    expect(siteUrl({})).toBe("http://localhost:17000");
  });
});

describe("languageAlternates", () => {
  it("lists both locales and points x-default at English", () => {
    expect(languageAlternates("/demos")).toEqual({
      "pt-BR": "/pt/demos",
      en: "/en/demos",
      "x-default": "/en/demos",
    });
  });
});

describe("pageMetadata", () => {
  const meta = pageMetadata({
    locale: "pt",
    path: "/experience",
    title: "Experiência",
    description: "Carreira",
    siteName: "Carlos Morais",
  });

  it("sets the canonical URL to the page itself", () => {
    expect(meta.alternates?.canonical).toBe("/pt/experience");
  });

  it("always carries the shared preview image", () => {
    expect(meta.openGraph?.images).toEqual([
      expect.objectContaining({ url: "/pt/opengraph-image" }),
    ]);
    expect(meta.twitter?.images).toEqual([expect.objectContaining({ url: "/pt/opengraph-image" })]);
  });
});

it("indexes every work page", () => {
  const pages = work.map((item) =>
    item.kind === "case" ? `/cases/${item.slug}` : `/projects/${item.slug}`,
  );
  expect(indexablePaths).toEqual(expect.arrayContaining(pages));
});
