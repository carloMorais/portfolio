"use client";

import { useEffect } from "react";
import { apiHttpUrl } from "./online";

/**
 * Pings the game API once, in the background, on pages that lead to the
 * RaceGame: Render's free plan sleeps after 15 idle minutes and takes up to
 * a minute to wake, so the earlier it hears from us, the less anyone waits
 * in the online lobby. Renders nothing; a failure is fine.
 */
export function WakeApi() {
  useEffect(() => {
    const url = apiHttpUrl();
    if (!url) return;
    fetch(`${url}/health`, { cache: "no-store" }).catch(() => {});
  }, []);
  return null;
}
