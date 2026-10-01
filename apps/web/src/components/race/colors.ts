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
  glass: string;
  stripe: string;
  headlight: string;
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
};

export const LIGHT: GameColors = {
  grass: "#d3e8b8",
  grassLine: "#c0dca0",
  kerb: "#e4dccb",
  bots: ["#ef6f6c", "#f2b134", "#3bb08f"],
  wheel: "#2d2b28",
  glass: "#d9eefc",
  stripe: "#fffaf0",
  headlight: "#ffe39a",
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
};

export const DARK: GameColors = {
  grass: "#1c2a1f",
  grassLine: "#243628",
  kerb: "#2d2b27",
  bots: ["#e86a67", "#e8a93a", "#38a385"],
  wheel: "#0b0b0b",
  glass: "#b9d7ec",
  stripe: "#f6efe2",
  headlight: "#ffe08a",
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
  dust: "#5a5345",
  spark: "#ffc94d",
};
