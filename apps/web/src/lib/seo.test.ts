import { work } from "@/content/work";
import { indexablePaths, languageAlternates, pageMetadata, siteUrl } from "./seo";

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, without a trailing slash", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://carlos.vercel.app/" })).toBe(
      "https://carlos.vercel.app",
    );
  });

  it("uses the chosen domain on Vercel, not the generated one, and localhost elsewhere", () => {
    expect(
      siteUrl({ VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "portfolio-kappa-lake-51.vercel.app" }),
    ).toBe("https://portfolio-carlomorais.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:17000");
  });
});

describe("languageAlternates", () => {
  it("lists both locales and points x-default at English", () => {
    expect(languageAlternates("/work")).toEqual({
      "pt-BR": "/pt/work",
      en: "/en/work",
      "x-default": "/en/work",
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
