import { LIGHT } from "./colors";

/**
 * The race's items as SVG, matching how `draw.ts` paints them on the canvas,
 * for the controls legend and the HUD. Items keep their game colours in both
 * themes (they're objects, not UI); the nitro badge uses the site's blue.
 */

type IconProps = { className?: string };

const BOLT = "M13 4 7.2 12.6h4.1L10.2 20 16 11.4h-4.1z";
const c = LIGHT;

export function BoltIcon({ className }: IconProps) {
  return (
    <svg viewBox="4 3 16 18" className={className} aria-hidden>
      <path d={BOLT} fill="currentColor" />
    </svg>
  );
}

/** Nitro: a glossy accent badge with a yellow bolt. */
export function NitroIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <ellipse cx="12" cy="21.5" rx="6" ry="1.6" className="fill-ink" opacity="0.13" />
      <circle cx="12" cy="11" r="9.5" className="fill-accent" />
      <ellipse
        cx="8.6"
        cy="7"
        rx="3.8"
        ry="2.1"
        transform="rotate(-34 8.6 7)"
        fill="#ffffff"
        opacity="0.35"
      />
      <path d={BOLT} transform="translate(0 -1)" fill={c.bolt} />
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
      <ellipse cx="12" cy="21" rx="8.5" ry="2" className="fill-ink" opacity="0.13" />
      <path d={body} fill={c.barrel} />
      <g clipPath="url(#race-barrel)">
        <rect x="2" y="7" width="20" height="2" fill={c.barrelHoop} />
        <rect x="2" y="15" width="20" height="2" fill={c.barrelHoop} />
        <rect x="7.5" y="3" width="2" height="18" fill="#ffffff" opacity="0.28" />
      </g>
      <ellipse cx="12" cy="3.5" rx="6" ry="1.6" fill={c.barrelHoop} />
      <ellipse cx="12" cy="3.5" rx="4.6" ry="1" fill={c.barrel} />
    </svg>
  );
}

export function LogIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 16" className={className} aria-hidden>
      <rect x="2" y="4" width="29" height="11" rx="5.5" className="fill-ink" opacity="0.13" />
      <rect x="1" y="2" width="29" height="11" rx="5.5" fill={c.log} />
      <path
        d="M6 6h14M9 9.5h11"
        strokeWidth="1.1"
        strokeLinecap="round"
        stroke={c.logBark}
        fill="none"
      />
      <circle cx="24.5" cy="7.5" r="4.2" fill={c.logEnd} />
      <circle cx="24.5" cy="7.5" r="2" fill="none" strokeWidth="1" stroke={c.logRing} />
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
      <ellipse cx="12" cy="21" rx="9" ry="2" className="fill-ink" opacity="0.13" />
      <rect x="3.5" y="18" width="17" height="3.5" rx="1.75" fill={c.coneBase} />
      <path d={cone} fill={c.cone} />
      <g clipPath="url(#race-cone)">
        <rect x="5" y="9.5" width="14" height="3.2" fill={c.coneBand} />
        <rect x="8.8" y="2" width="1.6" height="17" fill="#ffffff" opacity="0.25" />
      </g>
    </svg>
  );
}
