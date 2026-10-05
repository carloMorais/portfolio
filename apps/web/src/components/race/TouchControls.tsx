import type { ReactNode } from "react";

/** One on-screen directional/action button, shared by practice and online mode. */
export function TouchButton({
  label,
  onDown,
  onUp,
  children,
}: {
  label: string;
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
      className="size-14 touch-none rounded-full text-xl ring-1 ring-line active:bg-surface"
    >
      {children}
    </button>
  );
}
