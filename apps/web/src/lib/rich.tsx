import type { ReactNode } from "react";

/**
 * Rich-text tags for next-intl messages. `<k>` marks a keyword that gets a
 * brush stroke painted behind it when it scrolls into view.
 */
export const brushTags = {
  k: (chunks: ReactNode) => <span className="brush-mark brush-on-view">{chunks}</span>,
};
