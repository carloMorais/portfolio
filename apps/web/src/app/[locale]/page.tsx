import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { jobs, skillGroups, stats } from "@/content/career";
import { site } from "@/content/site";
import { work } from "@/content/work";
import { ContactSection } from "@/components/ContactSection";
import { CvDownloadLink } from "@/components/CvDownloadLink";
import { JobEntry } from "@/components/JobEntry";
import { PhotoSlot } from "@/components/PhotoSlot";
import { SectionHeader } from "@/components/SectionHeader";
import { SectionMinimap } from "@/components/SectionMinimap";
import { WorkCard } from "@/components/WorkCard";
import { HeroTitle } from "@/components/hero/HeroTitle";
import { ScrollHint } from "@/components/hero/ScrollHint";
import { TechGraph } from "@/components/hero/TechGraph";
import { ArrowIcon, GridIcon, PinIcon, PrincipleIcon } from "@/components/icons";
import { ageOn } from "@/lib/age";
import { brushTags } from "@/lib/rich";
import { localePath, pageMetadata, siteUrl } from "@/lib/seo";
import { PageTransition } from "@/components/PageTransition";

// Re-render daily so the age in the portrait caption stays current.
export const revalidate = 86400;

const coreStack = ["React", "Next.js", "TypeScript", "Node.js", "NestJS", "PostgreSQL"];
// "numbers" is too short a section to earn a minimap entry.
const minimapSections = ["intro", "work", "about", "career", "contact"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Metadata"), getLocale()]);
  return pageMetadata({
    locale,
    path: "",
    title: t("title"),
    absolute: true,
    description: t("description"),
    siteName: site.shortName,
  });
}

export default function HomePage() {
  const t = useTranslations("Home");
  const locale = useLocale();
  // Structured data so search engines know whose site this is.
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    alternateName: site.shortName,
    jobTitle: t("eyebrow"),
    url: `${siteUrl()}${localePath(locale, "")}`,
    email: `mailto:${site.email}`,
    address: { "@type": "PostalAddress", addressLocality: "Jacareí", addressCountry: "BR" },
    knowsAbout: coreStack,
    sameAs: [site.linkedin, site.github],
  };

  return (
    <PageTransition>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(person).replace(/</g, "\\u003c") }}
      />
      <SectionMinimap
        label={t("minimapLabel")}
        sections={minimapSections.map((id) => ({ id, label: t(`sections.${id}`) }))}
      />

      {/* Hero */}
      <section
        id="intro"
        className="relative isolate overflow-hidden md:flex md:min-h-[calc(100svh-4rem)] md:items-center"
      >
        <TechGraph
          labels={{
            phrases: t.raw("graph.phrases") as string[],
          }}
        />
        <div className="container-page grid gap-12 py-12 md:grid-cols-[1.35fr_1fr] md:items-stretch md:gap-16 md:pt-16 md:pb-24">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <div className="mt-5">
              <HeroTitle />
            </div>
            <p className="mt-6 flex items-center gap-1.5 text-sm text-muted">
              <PinIcon className="size-4" />
              {t("location")}
            </p>
            <p className="mt-5 max-w-xl text-lg text-muted text-pretty">{t("lead")}</p>
            <ul aria-label={t("stackLabel")} className="mt-7 flex flex-wrap gap-2">
              {coreStack.map((tech) => (
                <li
                  key={tech}
                  className="rounded-full px-3 py-1 text-sm text-muted ring-1 ring-line"
                >
                  {tech}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/demos" className="btn btn-primary group/cta">
                <GridIcon />
                {t("ctaWork")}
                <ArrowIcon className="size-4 transition-transform group-hover/cta:translate-x-0.5" />
              </Link>
              <CvDownloadLink />
            </div>
          </div>
          <PhotoSlot
            id="heroPortrait"
            priority
            stretch
            hoverCaption={t("portraitCaption", { age: ageOn(site.birthDate) })}
            sizes="(min-width: 768px) 40vw, 100vw"
          />
        </div>
        <ScrollHint href="#numbers" label={t("scrollHint")} />
      </section>

      {/* Numbers */}
      <section
        id="numbers"
        aria-label={t("statsLabel")}
        className="scroll-mt-16 border-y border-line"
      >
        <div className="container-page grid gap-y-10 py-12 md:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.value}
              className="reveal flex flex-col md:border-l md:border-line md:px-7 md:first:border-l-0 md:first:pl-0"
            >
              <p className="font-display text-5xl tracking-tight">{stat.value}</p>
              <p className="mt-2 max-w-[14rem] text-sm text-muted text-pretty">
                {stat.label[locale]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Work */}
      <section id="work" className="container-page scroll-mt-16 py-20 md:py-28">
        <SectionHeader
          eyebrow={t("workEyebrow")}
          title={t.rich("workTitle", brushTags)}
          lead={t("workLead")}
        />
        <div className="mt-14 grid gap-x-10 gap-y-16 md:grid-cols-2">
          {work.map((item) => (
            <WorkCard key={item.slug} item={item} />
          ))}
        </div>
        <Link href="/demos" className="btn btn-ghost group/cta mt-14">
          {t("workCta")}
          <ArrowIcon className="size-4 transition-transform group-hover/cta:translate-x-0.5" />
        </Link>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-16 border-t border-line">
        <div className="container-page grid items-start gap-12 py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:py-28">
          <PhotoSlot
            id="aboutWorkspace"
            sizes="(min-width: 768px) 40vw, 100vw"
            className="md:sticky md:top-24"
          />
          <div>
            <SectionHeader eyebrow={t("aboutEyebrow")} title={t.rich("aboutTitle", brushTags)} />
            <p className="mt-6 text-lg leading-relaxed text-pretty">{t("aboutBody")}</p>
            <ul className="mt-10 grid gap-3">
              {([1, 2, 3] as const).map((n) => (
                <li
                  key={n}
                  className="reveal group/card grid grid-cols-[2.5rem_1fr] gap-4 rounded-2xl p-5 ring-1 ring-line transition-colors hover:bg-surface/60 hover:ring-accent/30"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <PrincipleIcon n={n} />
                  </span>
                  <div>
                    <h3 className="font-medium">{t(`principle${n}Title`)}</h3>
                    <p className="mt-1 text-muted text-pretty">{t(`principle${n}Body`)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-16">
              <SectionHeader
                as="h3"
                size="md"
                eyebrow={t("skillsEyebrow")}
                title={t.rich("skillsTitle", brushTags)}
              />
              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                {skillGroups.map((group) => (
                  <div
                    key={group.title.en}
                    className="reveal rounded-2xl bg-surface/50 p-5 ring-1 ring-line"
                  >
                    <dt className="flex items-center gap-2 text-sm font-medium">
                      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                      {group.title[locale]}
                    </dt>
                    <dd className="mt-3 flex flex-wrap gap-1.5">
                      {group.items.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-bg px-2.5 py-1 text-xs text-muted ring-1 ring-line"
                        >
                          {item}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Career preview */}
      <div aria-hidden className="border-t border-line" />
      <section id="career" className="container-page scroll-mt-16 py-20 md:py-28">
        <SectionHeader
          eyebrow={t("experienceEyebrow")}
          title={t.rich("experienceTitle", brushTags)}
        />
        <div className="mt-10">
          {jobs.map((job) => (
            <JobEntry key={job.id} job={job} variant="compact" />
          ))}
        </div>
        <Link href="/experience" className="btn btn-ghost group/cta mt-4">
          {t("experienceCta")}
          <ArrowIcon className="size-4 transition-transform group-hover/cta:translate-x-0.5" />
        </Link>
      </section>

      <ContactSection />
    </PageTransition>
  );
}
