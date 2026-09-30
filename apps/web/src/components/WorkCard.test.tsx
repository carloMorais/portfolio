import { screen } from "@testing-library/react";
import { work, type WorkItem } from "@/content/work";
import { renderWithIntl } from "@/test/render";
import { WorkCard } from "./WorkCard";

const racegame = work.find((item) => item.slug === "racegame")!;

describe("WorkCard", () => {
  it("does not link to pages that are not ready", () => {
    renderWithIntl(<WorkCard item={{ ...racegame, ready: false }} />, "en");
    expect(screen.getByText("Case study coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: racegame.title.en })).not.toBeInTheDocument();
    // Only external links remain: the repo and the photo credit.
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("links ready items to their page", () => {
    const item: WorkItem = { ...racegame, ready: true };
    renderWithIntl(<WorkCard item={item} />, "pt");
    expect(screen.getByRole("link", { name: item.title.pt })).toHaveAttribute(
      "href",
      "/pt/projects/racegame",
    );
  });

  it("opens the source code in a new tab", () => {
    renderWithIntl(<WorkCard item={racegame} />, "en");
    expect(screen.getByRole("link", { name: /Code on GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/Projeto-Ciclo-2/RaceGame",
    );
  });
});
