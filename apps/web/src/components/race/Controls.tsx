import { useTranslations } from "next-intl";

/** Keyboard keys and track items, drawn instead of described. */
export function Controls() {
  const t = useTranslations("Play");

  return (
    <div className="mt-8">
      <h2 className="sr-only">{t("controlsTitle")}</h2>
      <p className="sr-only">{t("controlsKeys")}</p>
      <div aria-hidden className="flex flex-wrap items-end gap-x-10 gap-y-6 text-xs text-muted">
        <figure className="hidden flex-col items-center gap-2 lg:flex">
          <div className="flex items-end gap-3">
            <KeyCluster keys={["↑", "←", "↓", "→"]} />
            <span className="pb-2">{t("or")}</span>
            <KeyCluster keys={["W", "A", "S", "D"]} />
          </div>
          <figcaption>{t("drive")}</figcaption>
        </figure>
        <figure className="hidden flex-col items-center gap-2 lg:flex">
          <Key wide>{t("space")}</Key>
          <figcaption>{t("nitroKey")}</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 20 20" className="size-8">
            <path d="M10 1 17 10 10 19 3 10Z" className="fill-accent" />
          </svg>
          <figcaption>{t("itemNitro")}</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-2">
          <div className="flex h-8 items-center gap-2">
            <svg viewBox="0 0 20 20" className="size-6">
              <circle cx="10" cy="10" r="8" className="fill-muted" />
              <circle cx="10" cy="10" r="4.5" fill="none" strokeWidth="1.5" className="stroke-bg" />
            </svg>
            <svg viewBox="0 0 40 16" className="h-4 w-10">
              <rect x="1" y="2" width="38" height="12" rx="6" className="fill-muted" />
              <circle cx="32" cy="8" r="3" className="fill-bg" />
            </svg>
          </div>
          <figcaption>{t("itemObstacles")}</figcaption>
        </figure>
      </div>
      <p className="mt-6 text-sm text-muted lg:hidden">{t("controlsTouch")}</p>
    </div>
  );
}

/** An inverted T: up on top, left/down/right below. */
function KeyCluster({ keys: [up, left, down, right] }: { keys: [string, string, string, string] }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      <span />
      <Key>{up}</Key>
      <span />
      <Key>{left}</Key>
      <Key>{down}</Key>
      <Key>{right}</Key>
    </div>
  );
}

function Key({ children, wide = false }: { children: string; wide?: boolean }) {
  return (
    <kbd
      className={`grid h-8 place-items-center rounded-md bg-surface font-sans text-xs text-ink shadow-[0_2px_0_var(--line)] ring-1 ring-line ${wide ? "w-36" : "w-8"}`}
    >
      {children}
    </kbd>
  );
}
