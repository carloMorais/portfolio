/**
 * The game's own, single palette (01/10/2026: dropped the light/dark split —
 * Carlos wanted one version, closer to the 2024 game's own colours: grey
 * asphalt with a white dashed line, a light kerb, and vivid green grass).
 * None of this is traced from the original art (no licence for it) — it's a
 * fresh, flat 2D read of the same palette and the same kind of trackside
 * objects (trees, rocks, tires, oil barrels).
 */
export type GameColors = {
  road: string;
  roadDash: string;
  kerbOuter: string;
  kerbInner: string;
  /** Red-and-white kerbs on the corners. */
  kerbRed: string;
  kerbWhite: string;
  /** Gravel run-off outside the corners. */
  gravel: string;
  gravelDot: string;
  /** Painted grid slots. */
  gridLine: string;
  grass: string;
  grassBlotchDark: string;
  grassBlotchLight: string;
  checkpoint: string;
  border: string;
  wheel: string;
  stripe: string;
  helmet: string;
  standFront: string;
  standRow: string;
  standRowAlt: string;
  standRoof: string;
  tree: string;
  treeLight: string;
  rock: string;
  rockLight: string;
  tire: string;
  tireRim: string;
  /** The coloured band on top of a tire stack. */
  tireBand: string;
  oilBarrel: string;
  oilBarrelBand: string;
  fans: string[];
  bolt: string;
  barrel: string;
  barrelHoop: string;
  log: string;
  logBark: string;
  logEnd: string;
  logRing: string;
  cone: string;
  coneBase: string;
  coneBand: string;
  dust: string;
  spark: string;
  /** The starting gantry panel. */
  rig: string;
  /** A lit starting light. */
  lightOn: string;
};

export const COLORS: GameColors = {
  road: "#4c4f55",
  roadDash: "#eceae2",
  kerbOuter: "#cac6ba",
  kerbInner: "#edebe3",
  kerbRed: "#d4544a",
  kerbWhite: "#f3f1ea",
  gravel: "#d6c7a0",
  gravelDot: "#b9a883",
  gridLine: "#f3f1ea",
  // 05/10/2026: pulled a little towards olive, so the game sits on the cream page instead of jumping off it.
  grass: "#4d8a45",
  grassBlotchDark: "#41733a",
  grassBlotchLight: "#5c9b50",
  checkpoint: "#232323",
  border: "#232323",
  wheel: "#201f1d",
  stripe: "#fffaf0",
  helmet: "#fffaf0",
  standFront: "#7e7a71",
  standRow: "#b1aca1",
  standRowAlt: "#a39d90",
  standRoof: "#585349",
  tree: "#3d6f37",
  treeLight: "#58894a",
  rock: "#8f8d85",
  rockLight: "#aaa79c",
  tire: "#201f1d",
  tireRim: "#4a4642",
  tireBand: "#d4544a",
  // Scenery stays neutral (blue-grey), so only what you can hit is warm.
  oilBarrel: "#5f7383",
  oilBarrelBand: "#475866",
  fans: ["#ef6f6c", "#f2b134", "#3bb08f", "#5b8def", "#f3924a", "#b07cc6", "#fffaf0"],
  bolt: "#ffd166",
  barrel: "#e07a5f",
  barrelHoop: "#a9503a",
  log: "#b9855a",
  logBark: "#8f6240",
  logEnd: "#f0d4a8",
  logRing: "#c99b6a",
  cone: "#f3924a",
  coneBase: "#c96f2e",
  coneBand: "#fff7ea",
  dust: "#d6c9ae",
  spark: "#ffc94d",
  rig: "#201f1d",
  lightOn: "#e8432f",
};

export type CarColorId =
  "blue" | "coral" | "yellow" | "green" | "orange" | "purple" | "pink" | "cyan" | "lime" | "white";

/**
 * The colours a car can have (05/10/2026: each driver picks one, so you can
 * tell who is who). As many as a room's seats (`CAR_COLOR_COUNT`), so online
 * no two cars share one. `text` and `textDark` are the same hue as a
 * readable text colour on the site's light and dark surfaces (≥ 4.5:1), for
 * the driver's name in the standings, lobby and results.
 */
export const CAR_COLORS: { id: CarColorId; body: string; text: string; textDark: string }[] = [
  { id: "blue", body: "#3d6fe0", text: "#2a55b8", textDark: "#86a8ff" },
  { id: "coral", body: "#ef6f6c", text: "#b3403d", textDark: "#ff9a97" },
  { id: "yellow", body: "#f2b134", text: "#8a5d00", textDark: "#f6c55e" },
  { id: "green", body: "#3bb08f", text: "#1a6e56", textDark: "#5fd0ae" },
  { id: "orange", body: "#f3924a", text: "#a3531a", textDark: "#f7ad75" },
  { id: "purple", body: "#9b6bd6", text: "#6f43aa", textDark: "#bb98ea" },
  { id: "pink", body: "#e872b0", text: "#a83b78", textDark: "#f39cc9" },
  { id: "cyan", body: "#3fb6d6", text: "#196a80", textDark: "#6fd0ea" },
  { id: "lime", body: "#9bc53d", text: "#4d6e10", textDark: "#b7dc63" },
  { id: "white", body: "#f1efe8", text: "#6b665b", textDark: "#e7e4da" },
];

/** A car colour by index (online: the server's), wrapping just in case. */
export const carColor = (i: number) =>
  CAR_COLORS[((i % CAR_COLORS.length) + CAR_COLORS.length) % CAR_COLORS.length]!;
