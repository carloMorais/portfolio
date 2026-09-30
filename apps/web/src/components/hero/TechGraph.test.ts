import { buildTimeline } from "./TechGraph";

const route = {
  path: ["input", "react", "next", "nest", "prisma", "postgres"],
  dwell: 3.5,
  laps: 2,
};

describe("buildTimeline", () => {
  const { segments, duration } = buildTimeline(route);

  it("rests 200ms on every service reached, both ways, but never on the store", () => {
    const pauses = segments.filter((s) => s.kind === "pause");
    expect(pauses.map((s) => s.kind === "pause" && s.at)).toEqual([
      "react",
      "next",
      "nest",
      "prisma", // going down
      "prisma",
      "nest",
      "next",
      "react", // coming back
    ]);
    expect(pauses.every((s) => s.duration === 0.2)).toBe(true);
    expect(pauses.some((s) => s.kind === "pause" && s.at === "postgres")).toBe(false);
  });

  it("circles inside the store for the route's dwell", () => {
    const dwell = segments.filter((s) => s.kind === "dwell");
    expect(dwell).toHaveLength(1);
    expect(dwell[0]).toMatchObject({ at: "postgres", duration: 3.5 });
  });

  it("makes hops inside a cluster 200ms quicker than hops between clusters", () => {
    const hop = (from: string, to: string) =>
      segments.find((s) => s.kind === "move" && s.from === from && s.to === to)!.duration;
    expect(hop("react", "next")).toBeCloseTo(1.6); // inside the frontend
    expect(hop("nest", "prisma")).toBeCloseTo(1.6); // inside the backend
    expect(hop("next", "nest")).toBeCloseTo(1.8); // frontend → backend
  });

  it("lays segments back to back", () => {
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      expect(segments[i].start).toBeCloseTo(prev.start + prev.duration);
    }
    const last = segments.at(-1)!;
    expect(duration).toBeCloseTo(last.start + last.duration);
  });

  it("halves the packet on hops inside the frontend and the backend only", () => {
    const scaleOf = (from: string, to: string) => {
      const move = segments.find((s) => s.kind === "move" && s.from === from && s.to === to)!;
      return [move.scaleFrom, move.scaleTo];
    };
    expect(scaleOf("react", "next")).toEqual([0.5, 0.5]);
    expect(scaleOf("nest", "prisma")).toEqual([0.5, 0.5]);
    expect(scaleOf("input", "react")).toEqual([1, 1]);
    expect(scaleOf("next", "nest")).toEqual([1, 1]);
    expect(scaleOf("prisma", "postgres")).toEqual([1, 1]);
  });

  it("changes size during the pause: shrinking on arrival, growing before leaving", () => {
    const outbound = segments.filter((s) => s.kind === "pause" && s.forward);
    expect(outbound.map((s) => [s.kind === "pause" && s.at, s.scaleFrom, s.scaleTo])).toEqual([
      ["react", 1, 0.5], // arrives in the frontend
      ["next", 0.5, 1], // about to leave it
      ["nest", 1, 0.5], // arrives in the backend
      ["prisma", 0.5, 1], // about to leave it
    ]);
  });
});
