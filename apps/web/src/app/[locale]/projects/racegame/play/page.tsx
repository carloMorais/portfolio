import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { site } from "@/content/site";
import { Link } from "@/i18n/navigation";
import { ArrowIcon } from "@/components/icons";
import { PageTransition } from "@/components/PageTransition";
import { Controls } from "@/components/race/Controls";
import { PracticeRace } from "@/components/race/PracticeRace";
import { brushTags } from "@/lib/rich";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Play"), getLocale()]);
  return pageMetadata({
    locale,
    path: "/projects/racegame/play",
    title: t("metaTitle"),
    description: t("metaDescription"),
    siteName: site.shortName,
  });
}

export default function PlayPage() {
  const t = useTranslations("Play");

  return (
    <PageTransition>
      <section className="pt-10 pb-20 md:pt-16">
        <div className="container-page">
          <Link
            href="/projects/racegame"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            <ArrowIcon className="size-4 rotate-180" />
            {t("backToCase")}
          </Link>
          <p className="eyebrow mt-10">{t("eyebrow")}</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
            {t.rich("title", brushTags)}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted text-pretty">{t("lead")}</p>
          <p className="mt-3 max-w-2xl text-sm text-muted text-pretty">{t("note")}</p>
          <Controls />
        </div>

        {/* The game gets more room than the text column: as wide as the window allows. */}
        <div className="mx-auto mt-10 w-full max-w-[96rem] px-5 sm:px-8">
          <PracticeRace />
        </div>
      </section>
    </PageTransition>
  );
}
