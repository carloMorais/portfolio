import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "@/test/render";
import { LocaleSwitcher } from "./LocaleSwitcher";

jest.mock("next/navigation", () => ({
  usePathname: () => "/en/experience",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useParams: () => ({ locale: "en" }),
}));

describe("LocaleSwitcher", () => {
  it("starts closed and names the current language", () => {
    renderWithIntl(<LocaleSwitcher />, "en");

    const button = screen.getByRole("button", { name: "Language: English" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens a menu linking every language to the current page", async () => {
    renderWithIntl(<LocaleSwitcher />, "en");
    await userEvent.click(screen.getByRole("button", { name: "Language: English" }));

    expect(screen.getByRole("link", { name: "Português" })).toHaveAttribute(
      "href",
      "/pt/experience",
    );
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "true");
  });

  it("closes on Escape", async () => {
    renderWithIntl(<LocaleSwitcher />, "en");
    const button = screen.getByRole("button", { name: "Language: English" });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");

    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
