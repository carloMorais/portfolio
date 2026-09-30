import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site } from "@/content/site";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SiteNav } from "./SiteNav";

export function SiteHeader() {
  const t = useTranslations("Nav");

  return (
    <header
      className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md"
      // Anchored during page slides so only the content moves (see globals.css).
      style={{ viewTransitionName: "site-header" }}
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:rounded focus:bg-ink focus:px-3 focus:py-1.5 focus:text-bg"
      >
        {t("skipToContent")}
      </a>
      <div className="container-page grid h-16 grid-cols-[1fr_auto] items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="font-display text-xl tracking-tight"
        >
          {site.shortName}
          <span className="text-accent">.</span>
        </Link>
        <div className="flex items-center gap-3 md:contents">
          <SiteNav />
          <div className="md:justify-self-end">
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
