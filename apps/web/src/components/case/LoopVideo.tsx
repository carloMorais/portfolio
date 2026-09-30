"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  webm: string;
  mp4: string;
  poster: string;
  width: number;
  height: number;
  /** Describes what the clip shows (the video has no audio). */
  label: string;
  playLabel: string;
  pauseLabel: string;
};

/**
 * A muted, looping clip that plays on its own unless the reader prefers
 * reduced motion. It always has a pause button (WCAG 2.2.2).
 */
export function LoopVideo({
  webm,
  mp4,
  poster,
  width,
  height,
  label,
  playLabel,
  pauseLabel,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current?.play().catch(() => {});
  }, []);

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  return (
    <figure className="group relative max-w-3xl overflow-hidden rounded-[var(--radius-photo)] bg-surface ring-1 ring-line">
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        width={width}
        height={height}
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="block h-auto w-full"
      >
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        className="absolute right-3 bottom-3 rounded-full bg-bg/85 px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-line backdrop-blur transition-colors hover:text-ink"
      >
        {playing ? pauseLabel : playLabel}
      </button>
    </figure>
  );
}
