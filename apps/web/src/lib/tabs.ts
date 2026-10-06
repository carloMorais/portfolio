/**
 * The site's top-level tabs, in order. Every tab is a page (no in-page
 * anchors). The order also drives the page slide direction: moving to a tab
 * further right slides forward, moving left slides back.
 */
export const tabs = [
  { key: "home", href: "/" },
  { key: "experience", href: "/experience" },
  { key: "work", href: "/work" },
] as const;

/** Index of the tab that owns `pathname` (locale already stripped), or -1. */
export function tabIndex(pathname: string): number {
  return tabs.findIndex((tab) =>
    tab.href === "/"
      ? pathname === "/"
      : pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );
}

/** View-transition types for navigating from tab `from` to tab `to`. */
export function transitionTypesTo(from: number, to: number): string[] | undefined {
  if (from === to) return undefined;
  if (from === -1) return ["nav-forward"];
  return [to > from ? "nav-forward" : "nav-back"];
}
