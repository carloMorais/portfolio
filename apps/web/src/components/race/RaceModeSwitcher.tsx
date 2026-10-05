"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Controls } from "./Controls";
import { PracticeRace } from "./PracticeRace";
import { OnlineRace } from "./OnlineRace";

type Mode = "training" | "online";

/**
 * Toggles between practice mode (everything runs in the browser) and online
 * mode (a server-authoritative room via `apps/api`'s WebSocket gateway). The
 * lead/note text changes with the mode: they describe different things (one
 * is entirely client-side, the other runs on a server that can be asleep).
 */
export function RaceModeSwitcher({
  trainingLead,
  trainingNote,
}: {
  trainingLead: string;
  trainingNote: string;
}) {
  const t = useTranslations("Online");
  const [mode, setMode] = useState<Mode>("training");

  return (
    <>
      <div className="container-page">
        <div
          role="group"
          aria-label={`${t("modeTraining")} / ${t("modeOnline")}`}
          className="mt-5 inline-flex rounded-full bg-surface p-1 ring-1 ring-line"
        >
          {(["training", "online"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                mode === m ? "bg-ink text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {m === "training" ? t("modeTraining") : t("modeOnline")}
            </button>
          ))}
        </div>
        <p className="mt-5 max-w-2xl text-lg text-muted text-pretty">
          {mode === "training" ? trainingLead : t("lead")}
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted text-pretty">
          {mode === "training" ? trainingNote : t("note")}
        </p>
        <Controls />
      </div>

      {/* The game gets more room than the text column: as wide as the window allows. */}
      <div className="mx-auto mt-10 w-full max-w-[96rem] px-5 sm:px-8">
        {mode === "training" ? <PracticeRace /> : <OnlineRace />}
      </div>
    </>
  );
}
