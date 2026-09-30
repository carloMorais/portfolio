import { ageOn } from "./age";

describe("ageOn", () => {
  const birth = "2003-04-03";

  it("counts the birthday itself", () => {
    expect(ageOn(birth, new Date("2026-04-03T12:00:00Z"))).toBe(23);
  });

  it("does not count a birthday that has not happened yet", () => {
    expect(ageOn(birth, new Date("2026-04-02T12:00:00Z"))).toBe(22);
    expect(ageOn(birth, new Date("2027-03-31T12:00:00Z"))).toBe(23);
  });

  it("rolls over on the next birthday", () => {
    expect(ageOn(birth, new Date("2027-04-03T12:00:00Z"))).toBe(24);
  });
});
