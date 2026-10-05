/**
 * Guards for the non-negotiable content rules (kept in the local project notes). If one of these
 * fails, the site is about to publish something that isn't true (or isn't allowed).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { education, jobs } from "./career";
import { photos, type PhotoSlot } from "./photos";

const root = path.resolve(__dirname, "../..");
const publicText = [
  ...fs.readdirSync(path.join(root, "messages")).map((f) => path.join(root, "messages", f)),
  ...fs
    .readdirSync(path.join(root, "src/content"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => path.join(root, "src/content", f)),
].map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));

// The anonymized employer's name must not appear in a public repo, not even in
// this test, so it is matched by the SHA-256 of each word (see context/private.md).
const forbiddenWordHashes = new Set([
  "291271696194d40b33c53cd52252a71fa199ad4622d3e1149a93ab975a54971a",
  "1d043f2d534fae4056af7003801c168ed00ff98510875314b2057b43be57627b",
  "4fc39cd43a971541cad5ab80781e098262db5261933db9ae7bd59e379eff37f5",
]);
const namesEmployer = (text: string) =>
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).some((word) =>
    forbiddenWordHashes.has(createHash("sha256").update(word).digest("hex")),
  );

describe("content rules", () => {
  it("never names the anonymized employer anywhere in the repository", () => {
    // Every tracked text file ends up public on GitHub. The resume PDFs are the
    // agreed exception (binary, not scanned).
    const repoRoot = path.resolve(root, "../..");
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" })
      .split("\0")
      .filter((f) => f && !/\.(pdf|jpe?g|png|webm|mp4|ico)$/i.test(f));
    expect(tracked.length).toBeGreaterThan(50);
    for (const file of tracked) {
      const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
      expect({ file, hit: namesEmployer(file) || namesEmployer(text) }).toEqual({
        file,
        hit: false,
      });
    }
  });

  it("never names the anonymized employer", () => {
    for (const { file, text } of publicText) {
      expect({ file, hit: namesEmployer(text) }).toEqual({ file, hit: false });
    }
  });

  it("never claims AWS or MongoDB", () => {
    for (const { file, text } of publicText) {
      expect({ file, hit: /\bAWS\b|amazon web services|mongo/i.test(text) }).toEqual({
        file,
        hit: false,
      });
    }
  });

  it("does not advertise a job search (Carlos is employed)", () => {
    for (const { file, text } of publicText) {
      expect({
        file,
        hit: /busco (uma )?(vaga|oportunidade)|looking for (a|an|new) .*(role|job|position)|open to work/i.test(
          text,
        ),
      }).toEqual({ file, hit: false });
    }
  });

  it("keeps the Plumaa title without 'lead'", () => {
    const plumaa = jobs.find((job) => job.id === "plumaa")!;
    expect(plumaa.role.pt).toBe("Desenvolvedor Full-Stack");
    expect(plumaa.role.en).toBe("Full-Stack Developer");
  });

  it("keeps the real dates", () => {
    expect(jobs.map((job) => [job.id, job.start, job.end])).toEqual([
      ["plumaa", "2026-01", null],
      ["ai-startup", "2025-04", "2026-01"],
      ["bayer", "2024-06", "2025-01"],
    ]);
  });

  it("shows the IFRS course as in progress", () => {
    const ifrs = education.find((item) => item.id === "ifrs")!;
    expect(ifrs.inProgress).toBe(true);
    expect([ifrs.start, ifrs.end]).toEqual(["2026-08", "2027-01"]);
  });

  it("uses every photo in public/photos, with safe file names", () => {
    const files = fs.readdirSync(path.join(root, "public/photos")).sort();
    const used = Object.values(photos as Record<string, PhotoSlot>)
      .flatMap((slot) => (slot.src ? [slot.src.replace("/photos/", "")] : []))
      .sort();
    expect(files).toEqual(used);
    expect(files.filter(namesEmployer)).toEqual([]);
  });

  it("credits every stock photo", () => {
    for (const [id, slot] of Object.entries(photos as Record<string, PhotoSlot>)) {
      if (!slot.src || id === "heroPortrait") continue;
      expect({ id, credited: Boolean(slot.credit) }).toEqual({ id, credited: true });
    }
  });
});
