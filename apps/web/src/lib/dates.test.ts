import { formatYearMonth } from "./dates";

describe("formatYearMonth", () => {
  it("formats English months", () => {
    expect(formatYearMonth("2026-01", "en")).toBe("Jan 2026");
    expect(formatYearMonth("2024-06", "en")).toBe("Jun 2024");
  });

  it("formats Portuguese months without the trailing dot", () => {
    expect(formatYearMonth("2025-04", "pt")).toBe("Abr 2025");
    expect(formatYearMonth("2023-11", "pt")).toBe("Nov 2023");
  });
});
