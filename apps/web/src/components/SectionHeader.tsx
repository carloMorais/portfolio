import type { ReactNode } from "react";

type Props = {
  /** The small label above the title; most sections do without it. */
  eyebrow?: string;
  title: ReactNode;
  lead?: string;
  /** Heading level; sections under the page h1 use h2. */
  as?: "h1" | "h2" | "h3";
  size?: "lg" | "md";
};

export function SectionHeader({ eyebrow, title, lead, as: Heading = "h2", size = "lg" }: Props) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Heading
        className={`${eyebrow ? "mt-4" : ""} font-display leading-[1.1] tracking-tight text-balance ${
          size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {title}
      </Heading>
      {lead && <p className="mt-5 text-lg text-muted text-pretty">{lead}</p>}
    </div>
  );
}
