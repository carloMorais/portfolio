import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { plumaa } from "@/content/cases/plumaa";
import { site } from "@/content/site";
import { work } from "@/content/work";
import { pageMetadata } from "@/lib/seo";
import { CaseStudyLayout } from "@/components/case/CaseStudyLayout";

const item = work.find((w) => w.slug === "plumaa")!;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    path: "/cases/plumaa",
    title: item.title[locale],
    description: plumaa.lead[locale],
    siteName: site.shortName,
  });
}

export default function CasePage() {
  return <CaseStudyLayout item={item} study={plumaa} />;
}
