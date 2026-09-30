type IconProps = { className?: string };

export function PinIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor">
      <path
        d="M8 14.5s4.5-4.2 4.5-8a4.5 4.5 0 1 0-9 0c0 3.8 4.5 8 4.5 8Z"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6.5" r="1.6" strokeWidth="1.4" />
    </svg>
  );
}

export function GridIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor">
      <rect x="2" y="2" width="5" height="5" rx="1" strokeWidth="1.5" />
      <rect x="9" y="2" width="5" height="5" rx="1" strokeWidth="1.5" />
      <rect x="2" y="9" width="5" height="5" rx="1" strokeWidth="1.5" />
      <rect x="9" y="9" width="5" height="5" rx="1" strokeWidth="1.5" />
    </svg>
  );
}

export function ArrowIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor">
      <path
        d="M3 8h10m0 0L9 4m4 4-4 4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icons for the three "how I work" principles: tests, review, AI. */
export function PrincipleIcon({ n, className = "size-5" }: IconProps & { n: 1 | 2 | 3 }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor">
      {n === 1 && (
        <path
          d="M10 2.5 16 5v4.5c0 3.7-2.6 6.6-6 8-3.4-1.4-6-4.3-6-8V5l6-2.5Zm-2.6 7.6 1.9 1.9 3.4-3.6"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {n === 2 && (
        <path
          d="M6 4v12m0-12a2 2 0 1 0 0-.1M6 16a2 2 0 1 0 0 .1M14 16a2 2 0 1 0 0 .1M14 14V9a3 3 0 0 0-3-3H8.5m0 0L10.5 4m-2 2 2 2"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {n === 3 && (
        <path
          d="M10 2.5 11.6 8.4 17.5 10l-5.9 1.6L10 17.5l-1.6-5.9L2.5 10l5.9-1.6L10 2.5Z"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
