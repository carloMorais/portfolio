import type { Locale } from "@/i18n/routing";
import type { DiagramGroup, DiagramSpec } from "@/content/cases/types";

type Props = { spec: DiagramSpec; locale: Locale; description: string };

/** Marker ids are per variant: a marker inside a display:none SVG does not render. */
function Defs({ prefix }: { prefix: string }) {
  return (
    <defs>
      {(["accent", "muted"] as const).map((tone) => (
        <marker
          key={tone}
          id={`${prefix}-${tone}`}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={7}
          markerHeight={7}
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10z" className={tone === "accent" ? "fill-accent" : "fill-muted"} />
        </marker>
      ))}
    </defs>
  );
}

function Arrow({
  d,
  accent,
  both,
  prefix,
}: {
  d: string;
  accent?: boolean;
  both?: boolean;
  prefix: string;
}) {
  const marker = `url(#${prefix}-${accent ? "accent" : "muted"})`;
  return (
    <path
      d={d}
      fill="none"
      strokeWidth={1.5}
      className={accent ? "stroke-accent" : "stroke-muted"}
      markerEnd={marker}
      markerStart={both ? marker : undefined}
    />
  );
}

function Label({
  x,
  y,
  text,
  accent,
  anchor = "middle",
}: {
  x: number;
  y: number;
  text: string;
  accent?: boolean;
  anchor?: "middle" | "start";
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className={`text-[12px] ${accent ? "fill-accent" : "fill-muted"}`}
    >
      {text}
    </text>
  );
}

function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  small,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  small?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} className="fill-surface stroke-line" />
      <text
        x={x + (small ? 14 : 18)}
        y={y + (small ? 27 : 32)}
        className={`fill-ink font-display ${small ? "text-[16px]" : "text-[19px]"}`}
      >
        {title}
      </text>
      <text x={x + (small ? 14 : 18)} y={y + (small ? 46 : 52)} className="fill-muted text-[12px]">
        {sub}
      </text>
    </g>
  );
}

function Group({
  group,
  locale,
  x,
  y,
  w,
  h,
  step,
}: {
  group: DiagramGroup;
  locale: Locale;
  x: number;
  y: number;
  w: number;
  h: number;
  step: number;
}) {
  return (
    <g>
      <Box x={x} y={y} w={w} h={h} title={group.title[locale]} sub={group.sub[locale]} />
      {group.items.map((item, i) => (
        <g key={item.label.en}>
          <rect
            x={x + 16}
            y={y + 72 + i * step}
            width={w - 32}
            height={36}
            rx={8}
            className={item.accent ? "fill-bg stroke-accent" : "fill-bg stroke-line"}
          />
          <text
            x={x + 28}
            y={y + 95 + i * step}
            className={`text-[13px] ${item.accent ? "fill-accent" : "fill-ink"}`}
          >
            {item.label[locale]}
          </text>
        </g>
      ))}
    </g>
  );
}

const groupHeight = (items: number, step: number) => 72 + items * step - (step - 36) + 16;

function Wide({ spec, locale }: Omit<Props, "description">) {
  const prefix = "arch-wide";
  const step = 50;
  const rows = Math.max(spec.left.items.length, spec.middle.items.length);
  const h = groupHeight(rows, step);
  const m = spec.right.length;
  const rh = Math.min(64, (h - 12 * (m + 1)) / m);
  const gap = (h - m * rh) / (m + 1);

  return (
    <svg viewBox={`0 0 880 ${h + 16}`} className="hidden h-auto w-full md:block" aria-hidden>
      <Defs prefix={prefix} />
      <Group group={spec.left} locale={locale} x={8} y={8} w={250} h={h} step={step} />
      <Group group={spec.middle} locale={locale} x={400} y={8} w={250} h={h} step={step} />
      {spec.links.map((link) => {
        const y = 8 + 72 + link.row * step + 18;
        const d = link.dir === "left" ? `M408 ${y} H250` : `M250 ${y} H408`;
        return (
          <g key={link.label.en}>
            <Arrow prefix={prefix} d={d} accent={link.accent} both={link.dir === "both"} />
            <Label x={329} y={y - 8} text={link.label[locale]} accent={link.accent} />
          </g>
        );
      })}
      {spec.right.map((box, j) => {
        const y = 8 + gap + j * (rh + gap);
        return (
          <g key={box.title.en}>
            <Box
              x={720}
              y={y}
              w={152}
              h={rh}
              title={box.title[locale]}
              sub={box.sub[locale]}
              small
            />
            <Arrow prefix={prefix} d={`M650 ${y + rh / 2} H712`} both={box.both} />
          </g>
        );
      })}
    </svg>
  );
}

function Tall({ spec, locale }: Omit<Props, "description">) {
  const prefix = "arch-tall";
  const step = 46;
  const leftH = groupHeight(spec.left.items.length, step);
  const midY = 8 + leftH + 100;
  const midH = groupHeight(spec.middle.items.length, step);
  const zoneY = midY + midH + 56;
  const single = spec.right.length === 1;
  const rows = Math.ceil(spec.right.length / 2);
  const height = zoneY + rows * 76 + 8;
  const k = spec.links.length;

  return (
    <svg viewBox={`0 0 360 ${height}`} className="h-auto w-full md:hidden" aria-hidden>
      <Defs prefix={prefix} />
      <Group group={spec.left} locale={locale} x={8} y={8} w={344} h={leftH} step={step} />
      {spec.links.map((link, i) => {
        const x = Math.round(((i + 1) * 360) / (k + 1)) - 30;
        const top = 8 + leftH + 8;
        const bottom = midY - 8;
        const d = link.dir === "left" ? `M${x} ${bottom} V${top}` : `M${x} ${top} V${bottom}`;
        return (
          <g key={link.label.en}>
            <Arrow prefix={prefix} d={d} accent={link.accent} both={link.dir === "both"} />
            <Label
              x={x + 8}
              y={(top + bottom) / 2 + 4}
              text={link.label[locale]}
              accent={link.accent}
              anchor="start"
            />
          </g>
        );
      })}
      <Group group={spec.middle} locale={locale} x={8} y={midY} w={344} h={midH} step={step} />
      {(single ? [180] : [90, 270]).map((x) => (
        <Arrow prefix={prefix} key={x} d={`M${x} ${midY + midH + 8} V${zoneY - 8}`} />
      ))}
      {spec.right.map((box, j) => (
        <Box
          key={box.title.en}
          x={single ? 8 : 8 + (j % 2) * 180}
          y={zoneY + Math.floor(j / 2) * 76}
          w={single ? 344 : 164}
          h={64}
          title={box.title[locale]}
          sub={box.sub[locale]}
          small
        />
      ))}
    </svg>
  );
}

/** Architecture diagram for a case study: who sends what, and where state lives. */
export function ArchDiagram({ spec, locale, description }: Props) {
  return (
    <figure>
      <div role="img" aria-label={description}>
        <Wide spec={spec} locale={locale} />
        <Tall spec={spec} locale={locale} />
      </div>
      <figcaption className="mt-5 max-w-2xl text-sm text-muted text-pretty">
        {description}
      </figcaption>
    </figure>
  );
}
