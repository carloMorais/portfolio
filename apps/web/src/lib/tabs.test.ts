import { tabIndex, transitionTypesTo } from "./tabs";

describe("tabIndex", () => {
  it("maps paths to their tab", () => {
    expect(tabIndex("/")).toBe(0);
    expect(tabIndex("/experience")).toBe(1);
    expect(tabIndex("/demos")).toBe(2);
  });

  it("keeps nested pages under their tab", () => {
    expect(tabIndex("/demos/racegame")).toBe(2);
  });

  it("returns -1 outside the tabs", () => {
    expect(tabIndex("/cases/plumaa")).toBe(-1);
  });
});

describe("transitionTypesTo", () => {
  it("slides forward to tabs on the right and back to tabs on the left", () => {
    expect(transitionTypesTo(0, 2)).toEqual(["nav-forward"]);
    expect(transitionTypesTo(2, 1)).toEqual(["nav-back"]);
  });

  it("does not animate when staying on the same tab", () => {
    expect(transitionTypesTo(1, 1)).toBeUndefined();
  });
});
