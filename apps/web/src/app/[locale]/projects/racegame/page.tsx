import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";
import { racegame } from "@/content/cases/racegame";
import { site } from "@/content/site";
import { work } from "@/content/work";
import { pageMetadata } from "@/lib/seo";
import { CaseStudyLayout, Section } from "@/components/case/CaseStudyLayout";
import { LoopVideo } from "@/components/case/LoopVideo";
import { RaceModeSwitcher } from "@/components/race/RaceModeSwitcher";
import { WakeApi } from "@/components/race/WakeApi";

const item = work.find((w) => w.slug === "racegame")!;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    path: "/projects/racegame",
    title: item.title[locale],
    description: racegame.lead[locale],
    siteName: site.shortName,
  });
}

/**
 * The game comes first: a visitor plays it right under the title, then reads
 * the case study. The 2024 recording only shows up next to the rewrite, as
 * the "before".
 */
export default function RaceGamePage() {
  const t = useTranslations("Case");
  const locale = useLocale();
  const rewrite = racegame.rewrite!;

  return (
    <>
      <WakeApi />
      <CaseStudyLayout
        item={item}
        study={racegame}
        demo={<RaceModeSwitcher />}
        extra={
          <Section id="rewrite" title={rewrite.title[locale]}>
            {rewrite.paragraphs.map((p) => (
              <p key={p.en}>{p[locale]}</p>
            ))}
            <ul className="space-y-2.5 pt-2">
              {rewrite.bullets!.map((b) => (
                <li key={b.en} className="flex gap-3">
                  <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{b[locale]}</span>
                </li>
              ))}
            </ul>
            <div className="pt-6">
              <LoopVideo
                webm="/media/racegame/race.webm"
                mp4="/media/racegame/race.mp4"
                poster="/media/racegame/race-poster.jpg"
                width={492}
                height={312}
                label={t("racegameVideo")}
                playLabel={t("play")}
                pauseLabel={t("pause")}
              />
              <p className="mt-3 text-sm">{t("racegameOriginal")}</p>
            </div>
          </Section>
        }
      />
    </>
  );
}
