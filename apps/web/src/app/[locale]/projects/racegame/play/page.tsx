import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { site } from "@/content/site";
import { Link } from "@/i18n/navigation";
import { ArrowIcon } from "@/components/icons";
import { PageTransition } from "@/components/PageTransition";
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
      <section className="container-page pt-10 pb-20 md:pt-16">
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

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_16rem]">
          <PracticeRace />
          <aside className="text-sm text-muted text-pretty">
            <h2 className="font-display text-xl tracking-tight text-ink">{t("controlsTitle")}</h2>
            <p className="mt-3">{t("controlsKeys")}</p>
            <p className="mt-2 lg:hidden">{t("controlsTouch")}</p>
            <p className="mt-6 border-t border-line pt-6">{t("note")}</p>
          </aside>
        </div>
      </section>
    </PageTransition>
  );
}
