import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";
import { racegame } from "@/content/cases/racegame";
import { site } from "@/content/site";
import { work } from "@/content/work";
import { pageMetadata } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { ArrowIcon } from "@/components/icons";
import { CaseStudyLayout } from "@/components/case/CaseStudyLayout";
import { LoopVideo } from "@/components/case/LoopVideo";

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

export default function RaceGamePage() {
  const t = useTranslations("Case");
  const play = useTranslations("Play");

  return (
    <CaseStudyLayout
      item={item}
      study={racegame}
      actions={
        <Link href="/projects/racegame/play" className="btn btn-primary">
          {play("playCta")}
          <ArrowIcon className="size-4" />
        </Link>
      }
      media={
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
      }
    />
  );
}
