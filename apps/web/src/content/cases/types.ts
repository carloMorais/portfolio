import type { Localized } from "../career";

/** A titled block of prose (and optional bullets) inside a case study. */
export type CaseBlock = {
  title: Localized;
  paragraphs: Localized[];
  bullets?: Localized[];
};

export type DiagramItem = { label: Localized; accent?: boolean };

export type DiagramGroup = { title: Localized; sub: Localized; items: DiagramItem[] };

/**
 * A three-column architecture: who asks (left), who answers (middle) and the
 * stores and services behind it (right). `links` connect the left and middle
 * groups on the row of item `row`; `dir` says who sends ("right" = left to middle).
 */
export type DiagramSpec = {
  left: DiagramGroup;
  middle: DiagramGroup;
  right: { title: Localized; sub: Localized; both?: boolean }[];
  links: { row: number; label: Localized; dir: "right" | "left" | "both"; accent?: boolean }[];
};

/**
 * Every case study follows the same arc: context → problem → my part →
 * technical decisions → architecture diagram → result.
 */
export type CaseStudy = {
  slug: string;
  lead: Localized;
  facts: { label: Localized; value: Localized }[];
  context: Localized[];
  problem: Localized[];
  myPart: { paragraphs: Localized[]; bullets: Localized[] };
  decisions: CaseBlock[];
  diagram: DiagramSpec;
  /** One-paragraph reading of the diagram; also its accessible name. */
  architecture: Localized;
  result: Localized[];
  /** Optional closing story or honest look back. */
  afterword?: CaseBlock;
};

/** Same text in both languages (product names, acronyms). */
export const same = (text: string): Localized => ({ pt: text, en: text });
