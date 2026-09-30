"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Section = { id: string; label: string };

const ITEM_HEIGHT = 30;

/**
 * Notion/Docs-style outline pinned to the left edge (desktop only). At rest it
 * is a column of short bars; hovering or focusing expands it into labelled
 * links. A sliding indicator follows the section being read.
 */
export function SectionMinimap({ sections, label }: { sections: Section[]; label: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);

    // A section counts as "being read" when it crosses the middle of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(sections.findIndex((section) => section.id === entry.target.id));
          }
        }
      },
      { rootMargin: "-45% 0px -54% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label={label}
      data-minimap
      className="group/map fixed top-1/2 left-5 z-30 hidden -translate-y-1/2 xl:block"
      style={{ "--item-h": `${ITEM_HEIGHT}px` } as CSSProperties}
    >
      <div className="relative rounded-2xl py-2 pr-2 pl-2 transition-[background-color,box-shadow,backdrop-filter] duration-300 group-hover/map:bg-bg/85 group-hover/map:shadow-lg group-hover/map:ring-1 group-hover/map:ring-line group-hover/map:backdrop-blur-md group-focus-within/map:bg-bg/85 group-focus-within/map:shadow-lg group-focus-within/map:ring-1 group-focus-within/map:ring-line">
        {/* Sliding indicator that follows the active section. */}
        <span
          aria-hidden
          className="absolute left-2 h-[3px] w-6 rounded-full bg-accent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            top: 8 + ITEM_HEIGHT / 2 - 1.5,
            transform: `translateY(${active * ITEM_HEIGHT}px)`,
          }}
        />
        <ol>
          {sections.map((section, i) => {
            const current = i === active;
            return (
              <li key={section.id} style={{ height: ITEM_HEIGHT }}>
                <a
                  href={`#${section.id}`}
                  aria-current={current ? "location" : undefined}
                  className="flex h-full items-center gap-3 rounded-lg pr-1 focus-visible:outline-offset-0 group-hover/map:pr-3"
                >
                  <span
                    aria-hidden
                    className={`h-[3px] shrink-0 rounded-full transition-all duration-300 ${
                      current ? "w-6 bg-transparent" : "w-3.5 bg-line group-hover/map:w-5"
                    }`}
                  />
                  <span
                    className={`max-w-0 -translate-x-2 overflow-hidden text-sm whitespace-nowrap opacity-0 transition-all duration-300 group-hover/map:max-w-48 group-hover/map:translate-x-0 group-hover/map:opacity-100 group-focus-within/map:max-w-48 group-focus-within/map:translate-x-0 group-focus-within/map:opacity-100 ${
                      current ? "text-ink" : "text-muted hover:text-ink"
                    }`}
                    style={{ transitionDelay: `${i * 35}ms` }}
                  >
                    {section.label}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
