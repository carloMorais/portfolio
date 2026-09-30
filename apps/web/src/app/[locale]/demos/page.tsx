import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";
import { work } from "@/content/work";
import { SectionHeader } from "@/components/SectionHeader";
import { WorkCard } from "@/components/WorkCard";
import { brushTags } from "@/lib/rich";
import { PageTransition } from "@/components/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Demos"), getLocale()]);
  return pageMetadata({
    locale,
    path: "/demos",
    title: t("metaTitle"),
    description: t("metaDescription"),
    siteName: site.shortName,
  });
}

// For now this mirrors the "selected work" section of the home page.
export default function DemosPage() {
  const t = useTranslations("Demos");

  return (
    <PageTransition>
      <section className="container-page pt-12 pb-20 md:pt-20 md:pb-28">
        <SectionHeader
          as="h1"
          eyebrow={t("eyebrow")}
          title={t.rich("title", brushTags)}
          lead={t("lead")}
        />
        <div className="mt-14 grid gap-x-10 gap-y-16 md:grid-cols-2">
          {work.map((item) => (
            <WorkCard key={item.slug} item={item} headingLevel="h2" />
          ))}
        </div>
      </section>
    </PageTransition>
  );
}
