"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Flag } from "./Flag";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const current = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${t("label")}: ${t(current)}`}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm ring-1 ring-line transition-colors hover:ring-ink/40"
      >
        <Flag locale={current} />
        <span className="uppercase tracking-wider">{current}</span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
        >
          <path d="m3 4.5 3 3 3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <ul
        id={menuId}
        // Kept mounted so it can animate; inert + aria-hidden keep it out of reach while closed.
        aria-hidden={!open}
        inert={!open}
        className={`absolute top-full right-0 z-50 mt-2 min-w-40 origin-top-right overflow-hidden rounded-xl bg-bg p-1 shadow-lg ring-1 ring-line transition-[opacity,translate,scale,visibility] duration-200 ease-out ${
          open
            ? "visible translate-y-0 scale-100 opacity-100"
            : "invisible -translate-y-1 scale-95 opacity-0"
        }`}
      >
        {routing.locales.map((locale, i) => {
          const active = locale === current;
          return (
            <li
              key={locale}
              className={`transition-[opacity,translate] duration-300 ease-out ${
                open ? "translate-x-0 opacity-100" : "translate-x-1 opacity-0"
              }`}
              style={{ transitionDelay: open ? `${60 + i * 50}ms` : "0ms" }}
            >
              <Link
                href={pathname}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                aria-current={active ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface ${
                  active ? "font-medium" : "text-muted"
                }`}
              >
                <Flag locale={locale} />
                {t(locale)}
                {active && (
                  <svg
                    aria-hidden
                    viewBox="0 0 12 12"
                    className="ml-auto size-3 text-accent"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="m2.5 6.5 2.5 2.5 4.5-5"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
