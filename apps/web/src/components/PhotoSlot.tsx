import type { CSSProperties } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { photos, type PhotoId, type PhotoSlot as Slot } from "@/content/photos";

type Props = {
  id: PhotoId;
  className?: string;
  /** Forwarded to next/image; set on above-the-fold photos. */
  priority?: boolean;
  sizes?: string;
  /**
   * From `md` up, drop the aspect ratio and fill the parent's height, so the
   * photo matches the column next to it. Below `md` the ratio still applies.
   */
  stretch?: boolean;
  /** Text revealed over the bottom of the photo on hover. */
  hoverCaption?: string;
  /**
   * Slightly desaturated and darker at rest; full colour on hover of the photo
   * or of the surrounding `group` (e.g. a card).
   */
  muted?: boolean;
};

export function PhotoSlot({
  id,
  className = "",
  priority,
  sizes = "100vw",
  stretch,
  hoverCaption,
  muted,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("Photo");
  const slot: Slot = photos[id];

  return (
    <figure
      data-photo-slot={id}
      className={`group/photo relative isolate aspect-(--ratio) overflow-hidden rounded-[var(--radius-photo)] bg-surface ${
        stretch ? "md:aspect-auto md:h-full" : ""
      } ${className}`}
      style={{ "--ratio": slot.ratio.replace(/\s/g, "") } as CSSProperties}
    >
      {slot.src ? (
        <>
          <Image
            src={slot.src}
            alt={slot.alt[locale]}
            fill
            priority={priority}
            sizes={sizes}
            className={`object-cover transition-[scale,filter] duration-700 ease-out group-hover/photo:scale-[1.06] motion-reduce:transition-none ${
              muted
                ? "brightness-[0.88] saturate-[0.7] group-hover:brightness-100 group-hover:saturate-100 group-hover/photo:brightness-100 group-hover/photo:saturate-100"
                : ""
            }`}
            style={{ objectPosition: slot.position }}
          />
          {hoverCaption && (
            <p
              data-hover-caption
              className="absolute inset-x-0 bottom-0 z-10 translate-y-full bg-black/60 px-5 py-4 text-sm tracking-wide text-white backdrop-blur-sm transition-transform duration-500 ease-out group-hover/photo:translate-y-0 motion-reduce:transition-none"
            >
              {hoverCaption}
            </p>
          )}
          {slot.credit && (
            <figcaption className="absolute top-3 right-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[0.6875rem] leading-none text-white/90 backdrop-blur-sm">
              <a
                href={slot.credit.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                {t("credit", { author: slot.credit.author, source: slot.credit.source })}
              </a>
            </figcaption>
          )}
        </>
      ) : (
        <div
          role="img"
          aria-label={slot.alt[locale]}
          className="photo-placeholder absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center"
        >
          <span className="font-display text-lg text-muted italic">{t("placeholder")}</span>
          <span className="text-xs tracking-wide text-muted/80 uppercase">{slot.hint[locale]}</span>
        </div>
      )}
    </figure>
  );
}
