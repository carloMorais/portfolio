import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";
import { education, jobs, languages, volunteering } from "@/content/career";
import { CvDownloadLink } from "@/components/CvDownloadLink";
import { JobEntry } from "@/components/JobEntry";
import { formatYearMonth } from "@/lib/dates";
import { brushTags } from "@/lib/rich";
import { PageTransition } from "@/components/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Experience"), getLocale()]);
  return pageMetadata({
    locale,
    path: "/experience",
    title: t("metaTitle"),
    description: t("metaDescription"),
    siteName: site.shortName,
  });
}

export default function ExperiencePage() {
  const t = useTranslations("Experience");
  const common = useTranslations("Common");
  const locale = useLocale();

  return (
    <PageTransition>
      <section className="container-page pt-12 pb-12 md:pt-20">
        <p className="eyebrow">{t("eyebrow")}</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-2xl">
            <h1 className="font-display text-5xl tracking-tight sm:text-6xl">
              {t.rich("title", brushTags)}
            </h1>
            <p className="mt-5 text-lg text-muted text-pretty">{t("lead")}</p>
          </div>
          <CvDownloadLink />
        </div>
      </section>

      <section className="container-page pt-8 pb-20" aria-labelledby="jobs">
        <h2 id="jobs" className="font-display text-3xl tracking-tight">
          {t("jobsTitle")}
        </h2>
        <div className="mt-8">
          {jobs.map((job) => (
            <JobEntry key={job.id} job={job} />
          ))}
        </div>
      </section>

      <div aria-hidden className="border-t border-line" />

      <section className="container-page py-20" aria-labelledby="education">
        <h2 id="education" className="font-display text-3xl tracking-tight">
          {t("educationTitle")}
        </h2>
        <ul className="mt-8">
          {education.map((item) => (
            <li
              key={item.id}
              className="grid gap-2 border-t border-line py-8 md:grid-cols-[14rem_1fr] md:gap-10"
            >
              <div className="text-sm text-muted tabular-nums">
                {formatYearMonth(item.start, locale)} —{" "}
                {item.inProgress
                  ? `${common("expected")} ${formatYearMonth(item.end, locale)}`
                  : formatYearMonth(item.end, locale)}
              </div>
              <div>
                <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-xl tracking-tight">
                  {item.title[locale]}
                  {item.inProgress && (
                    <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-sans text-xs font-medium tracking-normal text-accent ring-1 ring-accent/30">
                      {common("inProgress")}
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-accent">{item.institution[locale]}</p>
                <p className="mt-3 text-muted text-pretty">{item.details[locale]}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div aria-hidden className="border-t border-line" />

      <section className="container-page grid gap-16 py-20 md:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl tracking-tight">{t("languagesTitle")}</h2>
          <dl className="mt-8 space-y-5">
            {languages.map((language) => (
              <div key={language.name.en}>
                <dt className="font-medium">{language.name[locale]}</dt>
                <dd className="mt-1 text-muted">{language.level[locale]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2 className="font-display text-3xl tracking-tight">{t("volunteeringTitle")}</h2>
          <p className="mt-8 font-medium">{volunteering.org}</p>
          <ul className="mt-3 space-y-2 text-muted">
            {volunteering.items.map((item) => (
              <li key={item.en} className="text-pretty">
                {item[locale]}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PageTransition>
  );
}
