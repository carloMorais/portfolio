import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CaseStudy } from "@/content/cases/types";
import type { WorkItem } from "@/content/work";
import { Link } from "@/i18n/navigation";
import { ArchDiagram } from "./ArchDiagram";
import { ArrowIcon } from "../icons";
import { PageTransition } from "../PageTransition";

type Props = {
  item: WorkItem;
  study: CaseStudy;
  /** Cover: a screenshot or clip of the real thing. */
  media?: ReactNode;
  /**
   * The real thing, playable, right under the title: a visitor tries it
   * first and reads about it after. Takes the cover's place; the facts move
   * below it.
   */
  demo?: ReactNode;
  /** Optional call to action under the facts. */
  actions?: ReactNode;
  /** More sections after the result, before the afterword. */
  extra?: ReactNode;
};

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t border-line py-12 md:grid-cols-[14rem_1fr] md:gap-10 md:py-16"
    >
      <h2 id={id} className="font-display text-2xl tracking-tight">
        {title}
      </h2>
      <div className="max-w-2xl space-y-4 text-lg text-muted text-pretty">{children}</div>
    </section>
  );
}

/**
 * The shared shape of every case study page:
 * context → problem → my part → decisions → architecture → result.
 */
export function CaseStudyLayout({ item, study, media, demo, actions, extra }: Props) {
  const locale = useLocale();
  const t = useTranslations("Case");
  const common = useTranslations("Common");

  const facts = (
    <>
      <dl className="grid gap-x-10 gap-y-6 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
        {study.facts.map((fact) => (
          <div key={fact.label.en}>
            <dt className="text-xs tracking-wide text-muted uppercase">{fact.label[locale]}</dt>
            <dd className="mt-1.5 text-pretty">{fact.value[locale]}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        {actions}
        {item.repo && (
          <a
            href={item.repo}
            target="_blank"
            rel="noreferrer"
            className="link-underline text-sm text-muted hover:text-ink"
          >
            {common("sourceCode")} ↗
          </a>
        )}
      </div>
    </>
  );

  return (
    <PageTransition>
      <article>
        {/* With a demo the header stays short, so the game starts above the fold. */}
        <header
          className={`container-page ${demo ? "pt-6 pb-5 md:pt-10" : "pt-10 pb-12 md:pt-16"}`}
        >
          <Link
            href="/demos"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            <ArrowIcon className="size-4 rotate-180" />
            {t("back")}
          </Link>
          <p className={`eyebrow ${demo ? "mt-6" : "mt-10"}`}>{item.context[locale]}</p>
          <h1
            className={`mt-4 font-display leading-[1.1] tracking-tight text-balance ${
              demo ? "text-3xl sm:text-4xl lg:text-[2.75rem]" : "max-w-3xl text-4xl sm:text-5xl"
            }`}
          >
            {item.title[locale]}
          </h1>
          <p
            className={`max-w-2xl text-muted text-pretty ${demo ? "mt-3 sm:text-lg" : "mt-5 text-lg"}`}
          >
            {study.lead[locale]}
          </p>
          {!demo && <div className="mt-10">{facts}</div>}
        </header>

        {demo ? (
          <>
            {demo}
            <div className="container-page mt-16">{facts}</div>
          </>
        ) : (
          <div className="container-page">{media}</div>
        )}

        <div className="container-page mt-16">
          <Section id="context" title={t("context")}>
            {study.context.map((p) => (
              <p key={p.en}>{p[locale]}</p>
            ))}
          </Section>

          <Section id="problem" title={t("problem")}>
            {study.problem.map((p) => (
              <p key={p.en}>{p[locale]}</p>
            ))}
          </Section>

          <Section id="my-part" title={t("myPart")}>
            {study.myPart.paragraphs.map((p) => (
              <p key={p.en}>{p[locale]}</p>
            ))}
            <ul className="space-y-2.5 pt-2">
              {study.myPart.bullets.map((b) => (
                <li key={b.en} className="flex gap-3">
                  <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{b[locale]}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="decisions" title={t("decisions")}>
            {/* An odd one out spans both columns instead of sitting alone in the last row. */}
            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {study.decisions.map((d) => (
                <div key={d.title.en} className="sm:last:odd:col-span-2">
                  <h3 className="font-display text-xl tracking-tight text-ink">
                    {d.title[locale]}
                  </h3>
                  {d.paragraphs.map((p) => (
                    <p key={p.en} className="mt-2 text-base">
                      {p[locale]}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </Section>

          <section aria-labelledby="architecture" className="border-t border-line py-12 md:py-16">
            <h2 id="architecture" className="font-display text-2xl tracking-tight">
              {t("architecture")}
            </h2>
            <div className="mt-8">
              <ArchDiagram
                spec={study.diagram}
                locale={locale}
                description={study.architecture[locale]}
              />
            </div>
          </section>

          <Section id="result" title={t("result")}>
            {study.result.map((p) => (
              <p key={p.en}>{p[locale]}</p>
            ))}
          </Section>

          {extra}

          {study.afterword && (
            <Section id="afterword" title={study.afterword.title[locale]}>
              {study.afterword.paragraphs.map((p) => (
                <p key={p.en}>{p[locale]}</p>
              ))}
            </Section>
          )}
        </div>

        <footer className="container-page pb-20">
          <div className="border-t border-line pt-10">
            <Link
              href="/demos"
              className="inline-flex items-center gap-1.5 font-medium text-accent"
            >
              {t("more")}
              <ArrowIcon className="size-4" />
            </Link>
          </div>
        </footer>
      </article>
    </PageTransition>
  );
}
