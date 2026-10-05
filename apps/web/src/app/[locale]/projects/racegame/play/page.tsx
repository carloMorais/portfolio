import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { site } from "@/content/site";
import { Link } from "@/i18n/navigation";
import { ArrowIcon } from "@/components/icons";
import { PageTransition } from "@/components/PageTransition";
import { RaceModeSwitcher } from "@/components/race/RaceModeSwitcher";
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
        </div>

        <RaceModeSwitcher trainingLead={t("lead")} trainingNote={t("note")} />
      </section>
    </PageTransition>
  );
}
