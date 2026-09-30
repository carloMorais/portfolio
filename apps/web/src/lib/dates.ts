import type { Locale } from "@/i18n/routing";

/** Formats "2025-04" as "Apr 2025" (en) or "Abr 2025" (pt), matching the resumes. */
export function formatYearMonth(value: string, locale: Locale): string {
  const [year, month] = value.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "");
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}
