"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { tabs, tabIndex, transitionTypesTo } from "@/lib/tabs";

export function SiteNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const current = tabIndex(pathname);

  // Sliding pill behind the active tab. Until it has been measured (first
  // paint), the active link paints its own background instead.
  const listRef = useRef<HTMLUListElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [animatePill, setAnimatePill] = useState(false);

  useLayoutEffect(() => {
    // Measure the <li>: it is positioned, so the link's own offsetLeft would be 0.
    const active =
      listRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.parentElement;
    setPill(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
  }, [pathname]);

  useEffect(() => {
    if (!pill || animatePill) return;
    const frame = requestAnimationFrame(() => setAnimatePill(true));
    return () => cancelAnimationFrame(frame);
  }, [pill, animatePill]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = (variant: "desktop" | "mobile") =>
    tabs.map((tab, i) => {
      const active = i === current;
      return (
        <li key={tab.key} className={variant === "desktop" ? "relative z-10" : undefined}>
          <Link
            href={tab.href}
            transitionTypes={transitionTypesTo(current, i)}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={
              variant === "desktop"
                ? `block rounded-full px-4 py-1.5 transition-colors duration-300 ${
                    active ? `text-bg ${pill ? "" : "bg-ink"}` : "text-muted hover:text-ink"
                  }`
                : `block py-1 ${active ? "text-ink" : "text-muted"}`
            }
          >
            {t(tab.key)}
          </Link>
        </li>
      );
    });

  return (
    <nav aria-label={t("primary")}>
      <ul
        ref={listRef}
        className="relative hidden items-center gap-1 rounded-full p-1 text-sm ring-1 ring-line md:flex"
      >
        {pill && (
          <li
            aria-hidden
            className={`absolute top-1 bottom-1 rounded-full bg-ink ${
              animatePill
                ? "transition-[left,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                : ""
            }`}
            style={{ left: pill.left, width: pill.width }}
          />
        )}
        {links("desktop")}
      </ul>

      <button
        type="button"
        className="rounded-full px-3 py-1.5 text-sm ring-1 ring-line md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("closeMenu") : t("openMenu")}
        onClick={() => setOpen((value) => !value)}
      >
        {t("menu")}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-bg md:hidden"
      >
        <ul className="container-page flex flex-col gap-3 py-6 font-display text-2xl">
          {links("mobile")}
        </ul>
      </div>
    </nav>
  );
}
