import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { WorkItem } from "@/content/work";
import { ArrowIcon } from "./icons";
import { PhotoSlot } from "./PhotoSlot";
import { TagList } from "./TagList";

type Props = {
  item: WorkItem;
  /** Use "h2" when the card sits directly under the page h1. */
  headingLevel?: "h2" | "h3";
};

export function WorkCard({ item, headingLevel: Heading = "h3" }: Props) {
  const locale = useLocale();
  const t = useTranslations("Common");
  const href = item.kind === "case" ? `/cases/${item.slug}` : `/projects/${item.slug}`;

  return (
    <article className="reveal group relative flex h-full flex-col" data-work={item.slug}>
      <PhotoSlot id={item.photo} muted sizes="(min-width: 768px) 50vw, 100vw" />

      <p className="mt-6 text-sm text-muted">
        {item.context[locale]} <span aria-hidden>·</span> {item.period[locale]}
      </p>

      <Heading className="mt-3 font-display text-2xl leading-snug tracking-tight text-balance sm:text-[1.7rem]">
        <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 group-hover:bg-[length:100%_1px]">
          {item.ready ? (
            <Link href={href} className="after:absolute after:inset-0">
              {item.title[locale]}
            </Link>
          ) : (
            item.title[locale]
          )}
        </span>
      </Heading>

      <p className="mt-3 text-muted text-pretty">{item.blurb[locale]}</p>
      <TagList tags={item.tags} className="mt-5 mb-6" />

      {/* mt-auto pins the footer so every card in a row ends on the same line. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 text-sm">
        {item.ready ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-accent">
            {item.kind === "case" ? t("viewCase") : item.playable ? t("playNow") : t("viewProject")}
            <ArrowIcon className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs tracking-wide text-muted uppercase">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-accent" />
            {t("comingSoon")}
          </span>
        )}
        {item.repo && (
          <a
            href={item.repo}
            target="_blank"
            rel="noreferrer"
            className="link-underline relative z-10 ml-auto text-muted hover:text-ink"
          >
            {t("sourceCode")} ↗
          </a>
        )}
      </div>
    </article>
  );
}
