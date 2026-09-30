"use client";

import { useEffect, useState } from "react";

/** "Scroll for more" cue at the bottom of the hero; fades out once the reader scrolls. */
export function ScrollHint({ href, label }: { href: string; label: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <a
      href={href}
      data-scroll-hint
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : undefined}
      className={`absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs tracking-[0.18em] text-muted uppercase transition-all duration-500 hover:text-ink md:flex ${
        hidden ? "pointer-events-none translate-y-2 opacity-0" : "opacity-100"
      }`}
    >
      <span className="relative flex h-8 w-5 justify-center rounded-full ring-1 ring-current/40">
        <span className="scroll-hint-dot mt-1.5 size-1 rounded-full bg-current" />
      </span>
      {label}
    </a>
  );
}
