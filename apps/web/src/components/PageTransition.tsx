import { ViewTransition, type ReactNode } from "react";

const directional = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
};

/**
 * Wrap each page's content so tab navigations slide horizontally: forward to a
 * tab on the right, back to one on the left (types come from the nav links).
 * Must live in page.tsx, not the layout — layouts persist, so they never
 * enter or exit.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={directional} exit={directional} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
