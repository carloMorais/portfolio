/**
 * The game's own colours. The site sticks to paper, ink and one blue; the
 * game is allowed more (asked for by Carlos, 01/10/2026): pastel grass, warm
 * obstacles and a colour per bot, in a light and a dark set. The road stays
 * the site's paper and your car the site's blue, so it still feels like home.
 */
export type GameColors = {
  grass: string;
  grassLine: string;
  kerb: string;
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
  /** The starting gantry: a dark panel, same in both themes (it's a physical rig). */
  rig: string;
  /** A lit starting light. Off ones are drawn in `wheel`, so they sit dark until lit. */
  lightOn: string;
};

export const LIGHT: GameColors = {
  grass: "#d3e8b8",
  grassLine: "#c0dca0",
  kerb: "#e4dccb",
  bots: ["#ef6f6c", "#f2b134", "#3bb08f"],
  wheel: "#2d2b28",
  stripe: "#fffaf0",
  helmet: "#fffaf0",
  standFront: "#b8ad98",
  standRow: "#e6dfd1",
  standRowAlt: "#d9d0bf",
  standRoof: "#8f8676",
  tree: "#7fb069",
  treeLight: "#a3c98a",
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
  rig: "#2a2826",
  lightOn: "#e8432f",
};

/**
 * Noticeably brighter than the first pass (01/10/2026): the grass, kerb and
 * stands sat only a shade above the near-black road and the whole map read
 * as too dark. Raised across the board; the vivid tones (bots, items) were
 * fine and are unchanged.
 */
export const DARK: GameColors = {
  grass: "#33543a",
  grassLine: "#3f6a46",
  kerb: "#5c5544",
  bots: ["#e86a67", "#e8a93a", "#38a385"],
  wheel: "#0b0b0b",
  stripe: "#f6efe2",
  helmet: "#f6efe2",
  standFront: "#655d4e",
  standRow: "#423d33",
  standRowAlt: "#4b4438",
  standRoof: "#746b5a",
  tree: "#3f7245",
  treeLight: "#528758",
  fans: ["#e86a67", "#e8a93a", "#38a385", "#6f9cf2", "#e6843f", "#b98ad0", "#f6efe2"],
  bolt: "#ffd166",
  barrel: "#d0705a",
  barrelHoop: "#8e4433",
  log: "#a77852",
  logBark: "#7d5537",
  logEnd: "#e2c294",
  logRing: "#b88a5c",
  cone: "#e6843f",
  coneBase: "#b25f25",
  coneBand: "#f4ece0",
  dust: "#6f6758",
  spark: "#ffc94d",
  rig: "#2a2826",
  lightOn: "#e8432f",
};
