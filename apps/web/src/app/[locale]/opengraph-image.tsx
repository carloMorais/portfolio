import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { site } from "@/content/site";

// Shared preview for every page of a locale (link previews on LinkedIn, WhatsApp…).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Carlos Morais — Full-Stack";

// Same "paper and ink" palette as globals.css (light theme).
const bg = "#f7f5f0";
const ink = "#1c1b19";
const muted = "#6b675f";
const line = "#ddd8cd";
const accent = "#2553b8";

const stack = ["React", "Next.js", "TypeScript", "Node.js", "NestJS", "PostgreSQL"];
const plain = (text: string) => text.replace(/<\/?k>/g, "");

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Home" });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: bg,
        color: ink,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 26, letterSpacing: 6, color: accent, textTransform: "uppercase" }}>
          {t("eyebrow")}
        </div>
        <div style={{ marginTop: 28, fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>
          {site.shortName}
        </div>
        <div style={{ marginTop: 24, fontSize: 40, color: muted, maxWidth: 940, lineHeight: 1.3 }}>
          {`${plain(t.raw("titleMain"))}, ${plain(t.raw("titleSub"))}`}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `2px solid ${line}`,
          paddingTop: 32,
          fontSize: 26,
          color: muted,
        }}
      >
        <div style={{ display: "flex" }}>{stack.join("  ·  ")}</div>
        <div
          style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: accent }}
        />
      </div>
    </div>,
    size,
  );
}
