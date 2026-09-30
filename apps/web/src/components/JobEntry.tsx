import { useLocale, useTranslations } from "next-intl";
import type { Job } from "@/content/career";
import { formatYearMonth } from "@/lib/dates";
import { TagList } from "./TagList";

type Props = {
  job: Job;
  /** "compact" shows role, company and period only (home preview). */
  variant?: "compact" | "full";
};

export function JobEntry({ job, variant = "full" }: Props) {
  const locale = useLocale();
  const t = useTranslations("Common");
  const period = `${formatYearMonth(job.start, locale)} — ${
    job.end ? formatYearMonth(job.end, locale) : t("present")
  }`;

  return (
    <article className="reveal grid gap-2 border-t border-line py-8 md:grid-cols-[14rem_1fr] md:gap-10">
      <div className="text-sm text-muted">
        <p className="tabular-nums">{period}</p>
        {variant === "full" && (
          <p className="mt-1">
            {job.location[locale]} · {job.workMode[locale]}
          </p>
        )}
      </div>
      <div>
        <h3 className="font-display text-xl tracking-tight sm:text-2xl">
          {job.role[locale]}
          <span className="text-muted"> · </span>
          <span className="text-accent">{job.company[locale]}</span>
        </h3>
        <p className="mt-2 text-muted">{job.summary[locale]}</p>
        {variant === "full" && (
          <>
            <ul className="mt-5 space-y-3">
              {job.highlights.map((highlight) => (
                <li key={highlight.en} className="relative pl-5 text-pretty">
                  <span aria-hidden className="absolute left-0 top-[0.7em] h-px w-2.5 bg-accent" />
                  {highlight[locale]}
                </li>
              ))}
            </ul>
            <TagList tags={job.tags} className="mt-6" />
          </>
        )}
      </div>
    </article>
  );
}
