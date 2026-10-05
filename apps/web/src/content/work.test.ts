import { demos, demosOrder, work } from "./work";

describe("demos", () => {
  it("puts the RaceGame second, after the main job", () => {
    expect(demos.map((item) => item.slug).slice(0, 2)).toEqual(["plumaa", "racegame"]);
  });

  it("has a place for every work card (a missing one would jump to the top)", () => {
    expect([...demosOrder].sort()).toEqual(work.map((item) => item.slug).sort());
  });
});
