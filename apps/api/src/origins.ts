/**
 * Which sites may talk to this API: the web app's production URL, its Vercel
 * preview URLs, any extra origin in `WEB_ORIGIN` (comma-separated) and, only
 * outside production, the local dev ports. Shared by CORS (`main.ts`) and the
 * WebSocket gateway, because browsers don't apply CORS to WebSockets: without
 * an explicit check, any site could open sockets here and use up the rooms.
 *
 * Render must set NODE_ENV=production, or localhost stays trusted (see CLAUDE.md).
 */
export function allowedOrigins(): (string | RegExp)[] {
  const isProduction = process.env.NODE_ENV === "production";
  const extra = (process.env.WEB_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [
    "https://portfolio-carlomorais.vercel.app",
    // Vercel preview deployments, one per push to `release`.
    /^https:\/\/portfolio-[a-z0-9-]+\.vercel\.app$/,
    ...extra,
    // Any local port in the project's 17xxx range (dev 17000, Playwright 17001, …).
    ...(isProduction ? [] : [/^http:\/\/localhost:17\d{3}$/]),
  ];
}

/**
 * Whether a WebSocket handshake's Origin header is allowed. Outside production
 * a missing origin is accepted too (Node clients in tests and scripts send
 * none); in production it isn't, since every browser sends one.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return process.env.NODE_ENV !== "production";
  return allowedOrigins().some((o) => (typeof o === "string" ? o === origin : o.test(origin)));
}
