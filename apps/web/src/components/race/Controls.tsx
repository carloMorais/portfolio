import { useTranslations } from "next-intl";
import { BarrelIcon, ConeIcon, LogIcon, NitroIcon } from "./icons";

/**
 * Keyboard keys and track items, drawn instead of described. It lives in the
 * card over the track before a race, right where you look before driving.
 */
export function Controls() {
  const t = useTranslations("Play");

  return (
    <div className="w-full">
      <p className="sr-only">{t("controlsKeys")}</p>
      <div
        aria-hidden
        className="flex flex-wrap items-end justify-center gap-x-7 gap-y-4 text-xs text-muted"
      >
        <figure className="hidden flex-col items-center gap-2 lg:flex">
          <div className="flex items-end gap-2">
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
          <NitroIcon className="size-7" />
          <figcaption>{t("itemNitro")}</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-2">
          <div className="flex h-7 items-center gap-2">
            <BarrelIcon className="size-5" />
            <LogIcon className="h-3.5 w-7" />
            <ConeIcon className="size-5" />
          </div>
          <figcaption>{t("itemObstacles")}</figcaption>
        </figure>
      </div>
      <p className="mt-4 text-xs text-muted lg:hidden">{t("controlsTouch")}</p>
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
      className={`grid h-7 place-items-center rounded-md bg-surface font-sans text-xs text-ink shadow-[0_2px_0_var(--line)] ring-1 ring-line ${wide ? "w-24" : "w-7"}`}
    >
      {children}
    </kbd>
  );
}
