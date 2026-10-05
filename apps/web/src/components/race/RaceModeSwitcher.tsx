"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PracticeRace } from "./PracticeRace";
import { OnlineRace } from "./OnlineRace";
import { isRoomCode } from "./online";

type Mode = "training" | "online";

/**
 * Toggles between practice mode (everything runs in the browser) and online
 * mode (a server-authoritative room via `apps/api`'s WebSocket gateway), with
 * one line saying what each is. An invite link (`?mode=online&room=<code>`)
 * opens straight into that room.
 */
export function RaceModeSwitcher() {
  const t = useTranslations("Online");
  const tPlay = useTranslations("Play");
  const [mode, setMode] = useState<Mode>("training");
  const [invite, setInvite] = useState<string | null>(null);

  // The address is read after hydration: the page itself is static.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") !== "online") return;
    const room = params.get("room");
    const id = requestAnimationFrame(() => {
      setInvite(isRoomCode(room) ? room : null);
      setMode("online");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const choose = (next: Mode) => {
    if (next === mode) return;
    // Leaving online drops its invite from the address bar; joining picks any open room.
    window.history.replaceState(null, "", window.location.pathname);
    setInvite(null);
    setMode(next);
  };

  return (
    <>
      <div className="container-page">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div
            role="group"
            aria-label={`${t("modeTraining")} / ${t("modeOnline")}`}
            className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line"
          >
            {(["training", "online"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => choose(m)}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  mode === m ? "bg-ink text-bg" : "text-muted hover:text-ink"
                }`}
              >
                {m === "training" ? t("modeTraining") : t("modeOnline")}
              </button>
            ))}
          </div>
          <p className="text-muted text-pretty">
            {mode === "training" ? tPlay("lead") : t("lead")}
          </p>
        </div>
      </div>

      {/* The game gets more room than the text column: as wide as the window allows. */}
      <div className="mx-auto mt-6 w-full max-w-[96rem] px-5 sm:px-8">
        {mode === "training" ? (
          <PracticeRace />
        ) : (
          <OnlineRace
            key={invite ?? "any"}
            invite={invite}
            onPracticeInstead={() => choose("training")}
          />
        )}
      </div>
    </>
  );
}
