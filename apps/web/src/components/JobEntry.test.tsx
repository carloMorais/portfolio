import { screen } from "@testing-library/react";
import { jobs } from "@/content/career";
import { renderWithIntl } from "@/test/render";
import { JobEntry } from "./JobEntry";

const [current, , past] = jobs;

describe("JobEntry", () => {
  it("labels the current job as ongoing", () => {
    renderWithIntl(<JobEntry job={current} />, "pt");
    expect(screen.getByText("Jan 2026 — Atual")).toBeInTheDocument();
  });

  it("shows the full period of a past job", () => {
    renderWithIntl(<JobEntry job={past} />, "en");
    expect(screen.getByText("Jun 2024 — Jan 2025")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(past.highlights.length);
  });

  it("hides highlights in the compact variant", () => {
    renderWithIntl(<JobEntry job={past} variant="compact" />, "en");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
