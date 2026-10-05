import type { ReactNode } from "react";

/** One on-screen directional/action button, shared by practice and online mode. */
export function TouchButton({
  label,
  onDown,
  onUp,
  primary = false,
  children,
}: {
  label: string;
  /** The accelerator: the one your thumb lives on, so it is bigger and filled. */
  primary?: boolean;
  onDown: () => void;
  onUp: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`touch-none rounded-full text-xl ${
        primary
          ? "size-16 bg-ink text-bg active:opacity-80"
          : "size-14 ring-1 ring-line active:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
