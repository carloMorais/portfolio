"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ModeSwitch, type RaceMode, type SlideFrom } from "./hud";
import { PracticeRace } from "./PracticeRace";
import { OnlineRace } from "./OnlineRace";
import { isRoomCode } from "./online";

/**
 * Practice mode (everything runs in the browser) or online mode (a
 * server-authoritative room via `apps/api`'s WebSocket gateway). The switch
 * lives on top of each mode's card over the track, and the card's content
 * slides in from the side you're heading to. An invite link
 * (`?mode=online&room=<code>`) opens straight into that room.
 */
export function RaceModeSwitcher() {
  const t = useTranslations("Online");
  const [mode, setMode] = useState<RaceMode>("training");
  const [invite, setInvite] = useState<string | null>(null);
  const [slideFrom, setSlideFrom] = useState<SlideFrom>(null);
  /** Online mode is connecting: the switch waits with the rest of the card. */
  const [busy, setBusy] = useState(false);

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

  // The slide is for the mode change only: a card that mounts later (the
  // lobby after "play again", say) just appears.
  useEffect(() => {
    if (!slideFrom) return;
    const id = setTimeout(() => setSlideFrom(null), 600);
    return () => clearTimeout(id);
  }, [slideFrom]);

  const choose = (next: RaceMode) => {
    if (next === mode) return;
    // Leaving online drops its invite from the address bar; joining picks any open room.
    window.history.replaceState(null, "", window.location.pathname);
    setInvite(null);
    // Online sits to the right of Practice, as in the switch.
    setSlideFrom(next === "online" ? "right" : "left");
    setMode(next);
  };

  const modeSwitch = <ModeSwitch mode={mode} onChange={choose} disabled={busy} t={t} />;

  return (
    // The game gets more room than the text column: as wide as the window allows.
    <div className="mx-auto mt-6 w-full max-w-[96rem] px-5 sm:px-8">
      {mode === "training" ? (
        <PracticeRace modeSwitch={modeSwitch} slideFrom={slideFrom} />
      ) : (
        <OnlineRace
          key={invite ?? "any"}
          invite={invite}
          onPracticeInstead={() => choose("training")}
          onBusy={setBusy}
          modeSwitch={modeSwitch}
          slideFrom={slideFrom}
        />
      )}
    </div>
  );
}
