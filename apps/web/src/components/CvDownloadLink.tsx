import { useLocale, useTranslations } from "next-intl";
import { cvFiles } from "@/content/career";

export function CvDownloadLink({ className = "btn btn-ghost" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("Common");

  return (
    <a href={cvFiles[locale]} download className={className}>
      <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor">
        <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 13h10" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {t("downloadCv")}
      <span className="text-xs text-muted">{t("downloadCvHint")}</span>
    </a>
  );
}
