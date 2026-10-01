import { createCar } from "race-engine";
import {
  bestLap,
  formatGap,
  formatTime,
  loadBest,
  loadDifficulty,
  resultRows,
  saveBest,
  updateBest,
} from "./session";

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  } as Storage;
};

const car = (id: string, finishedAt: number | null, lapTicks: number[]) => ({
  ...createCar(id, 0, 0),
  finishedAt,
  lapTicks,
});

describe("race session helpers", () => {
  test("formats times and gaps from ticks", () => {
    expect(formatTime(30 * 72.4)).toBe("1:12.4");
    expect(formatGap(42)).toBe("+1.4");
  });

  test("results show the winner's total, gaps for the rest, and each best lap", () => {
    const rows = resultRows([
      car("bot2", 1500, [760, 740]),
      car("you", 1542, [800, 742]),
      car("bot3", null, [900]),
    ]);
    expect(rows).toEqual([
      { id: "bot2", time: { kind: "total", ticks: 1500 }, bestLap: 740 },
      { id: "you", time: { kind: "gap", ticks: 42 }, bestLap: 742 },
      { id: "bot3", time: null, bestLap: 900 },
    ]);
    expect(bestLap(car("x", null, []))).toBeNull();
  });

  test("a personal best is kept per difficulty and only improves", () => {
    const storage = memoryStorage();
    expect(loadBest(storage, "normal")).toEqual({ race: null, lap: null, splits: null });

    const first = updateBest(loadBest(storage, "normal"), 1800, 880, [200, 420, 640, 760, 880]);
    expect(first).toMatchObject({ newRace: true, newLap: true });
    saveBest(storage, "normal", first.best);

    const slower = updateBest(loadBest(storage, "normal"), 1900, 860, [190, 400, 620, 740, 860]);
    expect(slower).toEqual({
      best: { race: 1800, lap: 860, splits: [190, 400, 620, 740, 860] },
      newRace: false,
      newLap: true,
    });
    expect(loadBest(storage, "hard")).toEqual({ race: null, lap: null, splits: null });
  });

  test("a faster race without a faster lap keeps the old splits", () => {
    const storage = memoryStorage();
    const first = updateBest(loadBest(storage, "normal"), 1800, 880, [880]);
    saveBest(storage, "normal", first.best);
    const faster = updateBest(loadBest(storage, "normal"), 1700, 890, null);
    expect(faster).toEqual({
      best: { race: 1700, lap: 880, splits: [880] },
      newRace: true,
      newLap: false,
    });
  });

  test("broken or blocked storage just means no record", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(loadBest(broken, "easy")).toEqual({ race: null, lap: null, splits: null });
    expect(loadDifficulty(broken)).toBe("normal");
    const garbage = memoryStorage();
    garbage.setItem("racegame:best:easy", "{oops");
    expect(loadBest(garbage, "easy")).toEqual({ race: null, lap: null, splits: null });
  });
});
