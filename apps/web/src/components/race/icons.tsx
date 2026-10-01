/**
 * The race's items as SVG, matching how `draw.ts` paints them on the canvas,
 * for the controls legend and the HUD. Colours are the site's tokens.
 */

type IconProps = { className?: string };

const BOLT = "M13 4 7.2 12.6h4.1L10.2 20 16 11.4h-4.1z";

export function BoltIcon({ className }: IconProps) {
  return (
    <svg viewBox="4 3 16 18" className={className} aria-hidden>
      <path d={BOLT} fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

/** Nitro: a glossy accent badge with a bolt. */
export function NitroIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <ellipse cx="12" cy="21.5" rx="6" ry="1.6" className="fill-ink" opacity="0.12" />
      <circle cx="12" cy="11" r="9.5" className="fill-accent" />
      <ellipse
        cx="8.6"
        cy="7"
        rx="3.8"
        ry="2.1"
        transform="rotate(-34 8.6 7)"
        className="fill-bg"
        opacity="0.3"
      />
      <path d={BOLT} transform="translate(0 -1)" className="fill-bg" />
    </svg>
  );
}

export function BarrelIcon({ className }: IconProps) {
  const body = "M6 3.5Q3 12 6 20.5H18Q21 12 18 3.5Z";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <clipPath id="race-barrel">
          <path d={body} />
        </clipPath>
      </defs>
      <ellipse cx="12" cy="21" rx="8.5" ry="2" className="fill-ink" opacity="0.12" />
      <path d={body} className="fill-muted" />
      <g clipPath="url(#race-barrel)">
        <rect x="2" y="7" width="20" height="2" className="fill-ink" opacity="0.28" />
        <rect x="2" y="15" width="20" height="2" className="fill-ink" opacity="0.28" />
        <rect x="7.5" y="3" width="2" height="18" className="fill-bg" opacity="0.3" />
      </g>
      <ellipse cx="12" cy="3.5" rx="6" ry="1.6" className="fill-muted" />
      <ellipse cx="12" cy="3.5" rx="4.5" ry="0.9" className="fill-bg" opacity="0.35" />
    </svg>
  );
}

export function LogIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 16" className={className} aria-hidden>
      <rect x="2" y="4" width="29" height="11" rx="5.5" className="fill-ink" opacity="0.12" />
      <rect x="1" y="2" width="29" height="11" rx="5.5" className="fill-muted" />
      <path
        d="M6 6h14M9 9.5h11"
        strokeWidth="1"
        strokeLinecap="round"
        className="stroke-ink"
        opacity="0.2"
      />
      <circle cx="24.5" cy="7.5" r="4.2" className="fill-surface" />
      <circle cx="24.5" cy="7.5" r="2" fill="none" strokeWidth="1" className="stroke-muted" />
    </svg>
  );
}

export function ConeIcon({ className }: IconProps) {
  const cone = "M6 18.5 10.6 4Q12 2 13.4 4L18 18.5Z";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <clipPath id="race-cone">
          <path d={cone} />
        </clipPath>
      </defs>
      <ellipse cx="12" cy="21" rx="9" ry="2" className="fill-ink" opacity="0.12" />
      <rect x="3.5" y="18" width="17" height="3.5" rx="1.75" className="fill-muted" />
      <path d={cone} className="fill-ink" />
      <g clipPath="url(#race-cone)">
        <rect x="5" y="9.5" width="14" height="3.2" className="fill-bg" />
        <rect x="8.8" y="2" width="1.6" height="17" className="fill-bg" opacity="0.25" />
      </g>
    </svg>
  );
}
