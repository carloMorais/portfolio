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
  grass: string;
  grassBlotchDark: string;
  grassBlotchLight: string;
  checkpoint: string;
  border: string;
  bots: [string, string, string];
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
  grass: "#3f8f49",
  grassBlotchDark: "#346f3d",
  grassBlotchLight: "#4ea655",
  checkpoint: "#232323",
  border: "#232323",
  bots: ["#ef6f6c", "#f2b134", "#3bb08f"],
  wheel: "#201f1d",
  stripe: "#fffaf0",
  helmet: "#fffaf0",
  standFront: "#7e7a71",
  standRow: "#b1aca1",
  standRowAlt: "#a39d90",
  standRoof: "#585349",
  tree: "#3c7a40",
  treeLight: "#55974f",
  rock: "#8f8d85",
  rockLight: "#aaa79c",
  tire: "#201f1d",
  tireRim: "#4a4642",
  oilBarrel: "#30342f",
  oilBarrelBand: "#1b1e1a",
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
