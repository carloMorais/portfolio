import en from "../../messages/en.json";
import pt from "../../messages/pt.json";

function keyPaths(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" ? keyPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe("translation files", () => {
  it("pt and en define exactly the same keys", () => {
    expect(keyPaths(pt).sort()).toEqual(keyPaths(en).sort());
  });

  it("have no empty strings", () => {
    for (const messages of [pt, en]) {
      const empty = keyPaths(messages).filter((path) => {
        const value = path
          .split(".")
          .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], messages);
        return typeof value === "string" && value.trim() === "";
      });
      expect(empty).toEqual([]);
    }
  });
});
