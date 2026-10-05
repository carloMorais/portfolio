import { NO_KEYS, type Keys } from "race-engine";

/**
 * Game controllers (the Gamepad API, standard mapping): the left stick or
 * the d-pad steers, the right trigger or A accelerates, the left trigger or B
 * brakes, X or the right bumper fires nitro, Start starts or pauses. The
 * engine takes on/off keys, so the triggers count past half-way.
 */

const STICK = 0.35;
const TRIGGER = 0.5;

const pressed = (pad: Gamepad, i: number, threshold = TRIGGER) => {
  const b = pad.buttons[i];
  return !!b && (b.pressed || b.value > threshold);
};

export class Pads {
  private startWas = false;

  /** The keys held on any connected pad, and whether Start was just pressed. */
  poll(): { keys: Keys; start: boolean } {
    const pads =
      typeof navigator !== "undefined" && navigator.getGamepads
        ? navigator.getGamepads().filter((p): p is Gamepad => !!p && p.mapping === "standard")
        : [];
    const keys = { ...NO_KEYS };
    let start = false;
    for (const pad of pads) {
      const x = pad.axes[0] ?? 0;
      keys.left ||= x < -STICK || pressed(pad, 14);
      keys.right ||= x > STICK || pressed(pad, 15);
      keys.up ||= pressed(pad, 7) || pressed(pad, 0);
      keys.down ||= pressed(pad, 6) || pressed(pad, 1);
      keys.nitro ||= pressed(pad, 2) || pressed(pad, 5);
      start ||= pressed(pad, 9);
    }
    const startPressed = start && !this.startWas;
    this.startWas = start;
    return { keys, start: startPressed };
  }
}

/**
 * What the car gets: keyboard, touch and pad together; with `autoGas` (the
 * phone option), the throttle is held for you unless you brake.
 */
export function mergeKeys(own: Keys, pad: Keys, autoGas: boolean): Keys {
  const k: Keys = {
    up: own.up || pad.up,
    down: own.down || pad.down,
    left: own.left || pad.left,
    right: own.right || pad.right,
    nitro: own.nitro || pad.nitro,
  };
  if (autoGas && !k.down) k.up = true;
  return k;
}

export const sameKeys = (a: Keys, b: Keys) =>
  a.up === b.up &&
  a.down === b.down &&
  a.left === b.left &&
  a.right === b.right &&
  a.nitro === b.nitro;
