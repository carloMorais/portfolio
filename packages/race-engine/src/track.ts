import { roundCorners } from "./shape.ts";
import type { Box, Track } from "./types.ts";

/** The 2024 walls, all square corners (and a few stepped ones). */
const ORIGINAL_WALLS: Box[] = [
  { x: 0, y: 0, width: 55, height: 600 },
  { x: 55, y: 0, width: 25, height: 25 },
  { x: 80, y: 0, width: 760, height: 15 },
  { x: 195, y: 15, width: 115, height: 15 },
  { x: 210, y: 30, width: 80, height: 20 },
  { x: 210, y: 50, width: 70, height: 90 },
  { x: 210, y: 140, width: 80, height: 110 },
  { x: 290, y: 170, width: 30, height: 80 },
  { x: 320, y: 180, width: 220, height: 70 },
  { x: 490, y: 250, width: 50, height: 10 },
  { x: 515, y: 260, width: 25, height: 20 },
  { x: 525, y: 280, width: 15, height: 135 },
  { x: 700, y: 15, width: 60, height: 15 },
  { x: 720, y: 30, width: 50, height: 570 },
  { x: 710, y: 560, width: 10, height: 10 },
  { x: 690, y: 570, width: 30, height: 10 },
  { x: 55, y: 570, width: 25, height: 10 },
  { x: 55, y: 580, width: 665, height: 20 },
  { x: 125, y: 85, width: 15, height: 425 },
  { x: 140, y: 290, width: 10, height: 220 },
  { x: 150, y: 320, width: 30, height: 190 },
  { x: 180, y: 325, width: 275, height: 185 },
  { x: 455, y: 470, width: 15, height: 10 },
  { x: 455, y: 480, width: 25, height: 30 },
  { x: 480, y: 480, width: 20, height: 30 },
  { x: 500, y: 490, width: 80, height: 20 },
  { x: 580, y: 480, width: 30, height: 30 },
  { x: 610, y: 90, width: 40, height: 420 },
  { x: 350, y: 90, width: 260, height: 15 },
  { x: 590, y: 105, width: 20, height: 10 },
];

/**
 * The 2024 track (backend/src/game/controller/mapController.ts), 760 × 600.
 * The race starts on the bottom straight heading left, climbs the left side,
 * runs the S through the middle, comes back across the top and down the right
 * side to the finish.
 *
 * Redrawn in 2026 with rounded corners: the original walls go through
 * `roundCorners`, which turns every curve into 1 px boxes. Outside corners
 * get a 20 px radius (lanes are at least ~70 px wide); wall tips get 6 px
 * (the thinnest walls are 15 px). A few items moved a few pixels off the new
 * curves, and three barrels became cones.
 */
export const classicTrack: Track = {
  width: 760,
  height: 600,
  spawn: { x: 380, y: 540 },
  walls: roundCorners(ORIGINAL_WALLS, 760, 600, { outer: 20, inner: 6 }),
  checkpoints: [
    { order: 1, x: 50, y: 400, width: 80, height: 20 },
    { order: 2, x: 140, y: 100, width: 80, height: 20 },
    { order: 3, x: 540, y: 300, width: 80, height: 20 },
    { order: 4, x: 640, y: 300, width: 80, height: 20 },
    { order: 5, x: 420, y: 500, width: 20, height: 80 },
  ],
  finishLine: { x: 330, y: 500, width: 37, height: 80 },
  items: [
    { id: "a", type: 2, x: 60, y: 450, width: 20, height: 20 },
    { id: "b", type: 1, x: 90, y: 420, width: 20, height: 20 },
    { id: "c", type: 2, x: 180, y: 160, width: 20, height: 20 },
    { id: "d", type: 4, x: 300, y: 300, width: 20, height: 20 },
    { id: "e", type: 2, x: 380, y: 150, width: 20, height: 20 },
    { id: "f", type: 4, x: 440, y: 20, width: 20, height: 20 },
    { id: "g", type: 1, x: 660, y: 150, width: 20, height: 20 },
    { id: "h", type: 3, x: 650, y: 450, width: 25, height: 30 },
    { id: "i", type: 1, x: 600, y: 520, width: 20, height: 20 },
    { id: "j", type: 4, x: 80, y: 549, width: 20, height: 20 },
    { id: "k", type: 2, x: 58, y: 534, width: 20, height: 20 },
    { id: "l", type: 2, x: 153, y: 280, width: 20, height: 20 },
    { id: "m", type: 1, x: 150, y: 550, width: 20, height: 20 },
  ],
  // Drawn over the track image; the race test checks a bot can follow it.
  waypoints: [
    { x: 300, y: 545 },
    { x: 95, y: 540 },
    { x: 92, y: 300 },
    { x: 100, y: 55 },
    { x: 178, y: 60 },
    { x: 178, y: 200 },
    { x: 205, y: 285 },
    { x: 470, y: 288 },
    { x: 492, y: 330 },
    { x: 492, y: 440 },
    { x: 575, y: 445 },
    { x: 572, y: 300 },
    { x: 560, y: 150 },
    { x: 450, y: 140 },
    { x: 325, y: 140 },
    { x: 320, y: 60 },
    { x: 450, y: 55 },
    { x: 680, y: 55 },
    { x: 685, y: 150 },
    { x: 685, y: 300 },
    { x: 685, y: 540 },
    { x: 600, y: 545 },
    { x: 430, y: 545 },
  ],
};
