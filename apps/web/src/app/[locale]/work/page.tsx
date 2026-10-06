import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { site } from "@/content/site";
import { WakeApi } from "@/components/race/WakeApi";
import { pageMetadata } from "@/lib/seo";
import { work } from "@/content/work";
import { SectionHeader } from "@/components/SectionHeader";
import { WorkCard, isWide } from "@/components/WorkCard";
import { brushTags } from "@/lib/rich";
import { PageTransition } from "@/components/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Demos"), getLocale()]);
  return pageMetadata({
    locale,
    path: "/work",
    title: t("metaTitle"),
    description: t("metaDescription"),
    siteName: site.shortName,
  });
}

// The same cards as the "selected work" section of the home page.
export default function WorkPage() {
  const t = useTranslations("Demos");

  return (
    <PageTransition>
      <WakeApi />
      <section className="container-page pt-12 pb-20 md:pt-20 md:pb-28">
        <SectionHeader
          as="h1"
          eyebrow={t("eyebrow")}
          title={t.rich("title", brushTags)}
          lead={t("lead")}
        />
        <div className="mt-14 grid gap-x-10 gap-y-16 md:grid-cols-2">
          {work.map((item, i) => (
            <WorkCard key={item.slug} item={item} headingLevel="h2" wide={isWide(i, work.length)} />
          ))}
        </div>
      </section>
    </PageTransition>
  );
}
