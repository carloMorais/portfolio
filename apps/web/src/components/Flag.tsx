import { useId } from "react";
import type { Locale } from "@/i18n/routing";

// Simplified round flags as inline SVG (emoji flags don't render on Windows).
export function Flag({
  locale,
  className = "size-[1.125rem]",
}: {
  locale: Locale;
  className?: string;
}) {
  // Unique per instance: the same flag renders in the button and in the menu.
  const clipId = `flag-${locale}-${useId().replace(/[^\w-]/g, "")}`;

  return (
    <svg aria-hidden viewBox="0 0 20 20" className={`shrink-0 ${className}`}>
      <clipPath id={clipId}>
        <circle cx="10" cy="10" r="10" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {locale === "pt" ? (
          <>
            <rect width="20" height="20" fill="#1e9b4b" />
            <path d="M10 3.5 17.5 10 10 16.5 2.5 10Z" fill="#f9d52b" />
            <circle cx="10" cy="10" r="3.6" fill="#1f3f95" />
          </>
        ) : (
          <>
            <rect width="20" height="20" fill="#f4f4f4" />
            {[0, 5.7, 11.4, 17.1].map((y) => (
              <rect key={y} y={y} width="20" height="2.9" fill="#c8363d" />
            ))}
            <rect width="10" height="11.4" fill="#2b3d8c" />
          </>
        )}
      </g>
      <circle cx="10" cy="10" r="9.5" fill="none" stroke="currentColor" strokeOpacity=".12" />
    </svg>
  );
}
