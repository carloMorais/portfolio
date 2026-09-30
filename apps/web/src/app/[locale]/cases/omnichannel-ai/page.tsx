import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { omnichannelAi } from "@/content/cases/omnichannel-ai";
import { site } from "@/content/site";
import { work } from "@/content/work";
import { pageMetadata } from "@/lib/seo";
import { CaseStudyLayout } from "@/components/case/CaseStudyLayout";
import { PhotoSlot } from "@/components/PhotoSlot";

const item = work.find((w) => w.slug === "omnichannel-ai")!;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    path: "/cases/omnichannel-ai",
    title: item.title[locale],
    description: omnichannelAi.lead[locale],
    siteName: site.shortName,
  });
}

export default function CasePage() {
  return (
    <CaseStudyLayout
      item={item}
      study={omnichannelAi}
      media={
        <div className="max-w-3xl">
          <PhotoSlot id={item.photo} priority sizes="(min-width: 48rem) 48rem, 100vw" />
        </div>
      }
    />
  );
}
