import { work } from "./work";

describe("work", () => {
  it("lists the RaceGame second, after the main job, on the home and the Demos tab", () => {
    expect(work.map((item) => item.slug)).toEqual([
      "plumaa",
      "racegame",
      "omnichannel-ai",
      "bayer",
    ]);
  });
});
