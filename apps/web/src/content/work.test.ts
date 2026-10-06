import { isWide } from "@/components/WorkCard";
import { work } from "./work";

describe("work", () => {
  it("lists the RaceGame second, after the main job, then Renova and Food Point last, on the home and the Work tab", () => {
    expect(work.map((item) => item.slug)).toEqual([
      "plumaa",
      "racegame",
      "omnichannel-ai",
      "bayer",
      "renova",
      "food-point",
    ]);
  });

  it("has an even number of cards, so none spans both columns", () => {
    expect(work.length).toBe(6);
    expect(work.some((_, i) => isWide(i, work.length))).toBe(false);
  });
});
