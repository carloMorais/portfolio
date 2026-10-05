import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { renova } from "@/content/cases/renova";
import { site } from "@/content/site";
import { work } from "@/content/work";
import { pageMetadata } from "@/lib/seo";
import { CaseStudyLayout } from "@/components/case/CaseStudyLayout";
import { FipeChatDemo } from "@/components/renova/FipeChatDemo";

const item = work.find((w) => w.slug === "renova")!;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    path: "/projects/renova",
    title: item.title[locale],
    description: renova.lead[locale],
    siteName: site.shortName,
  });
}

/**
 * Like the RaceGame page, the demo comes first: a replay of the chatbot,
 * with the real FIPE calls on the side, then the case study.
 */
export default function RenovaPage() {
  return <CaseStudyLayout item={item} study={renova} demo={<FipeChatDemo />} />;
}
