import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * The hero headline, split at the em dash into an h1 and a supporting h2.
 * Words wrapped in <k> get a brush stroke that paints in behind them, one
 * after another, when the page loads.
 */
export function HeroTitle() {
  const t = useTranslations("Home");
  let index = 0;
  const k = (chunks: ReactNode) => (
    <span className="brush-mark" style={{ "--i": index++ } as CSSProperties}>
      {chunks}
    </span>
  );

  return (
    <>
      <h1 className="hero-title font-display text-[2.6rem] leading-[1.04] tracking-tight text-balance sm:text-6xl lg:text-7xl">
        {t.rich("titleMain", { k })}
      </h1>
      <h2 className="mt-3 font-display text-2xl leading-snug text-balance italic sm:text-3xl lg:text-4xl">
        {t.rich("titleSub", { k })}
      </h2>
    </>
  );
}
