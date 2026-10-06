import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { foodPoint } from "@/content/cases/food-point";
import { site } from "@/content/site";
import { work } from "@/content/work";
import { pageMetadata } from "@/lib/seo";
import { CaseStudyLayout } from "@/components/case/CaseStudyLayout";
import { FoodPointDemo } from "@/components/food-point/FoodPointDemo";

const item = work.find((w) => w.slug === "food-point")!;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    path: "/projects/food-point",
    title: item.title[locale],
    description: foodPoint.lead[locale],
    siteName: site.shortName,
  });
}

/**
 * Like the RaceGame and Renova pages, the demo comes first: the 2024
 * frontend itself, with its server simulated in the browser.
 */
export default function FoodPointPage() {
  return <CaseStudyLayout item={item} study={foodPoint} demo={<FoodPointDemo />} />;
}
