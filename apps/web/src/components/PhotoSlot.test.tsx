import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/render";
import { photos, type PhotoSlot as Slot } from "@/content/photos";
import { PhotoSlot } from "./PhotoSlot";

// Every slot is filled today, so empty one temporarily to exercise the placeholder.
const slot: Slot = photos.contactPortrait;
const slotSrc = slot.src;

describe("PhotoSlot", () => {
  describe("without an image", () => {
    beforeEach(() => {
      slot.src = undefined;
    });
    afterEach(() => {
      slot.src = slotSrc;
    });

    it("renders a labelled placeholder while the slot has no image", () => {
      renderWithIntl(<PhotoSlot id="contactPortrait" />, "en");

      expect(
        screen.getByRole("img", { name: "Two people talking in front of a laptop" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Photo coming soon")).toBeInTheDocument();
    });

    it("localizes the placeholder", () => {
      renderWithIntl(<PhotoSlot id="contactPortrait" />, "pt");

      expect(
        screen.getByRole("img", {
          name: "Duas pessoas conversando em frente a um notebook",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Foto em breve")).toBeInTheDocument();
    });
  });

  it("renders the image with localized alt text", () => {
    renderWithIntl(<PhotoSlot id="heroPortrait" />, "pt");

    expect(
      screen.getByRole("img", { name: "Retrato de Carlos Morais, sorrindo" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Foto:/)).not.toBeInTheDocument();
  });

  it("credits stock photos with a link to the source", () => {
    renderWithIntl(<PhotoSlot id="contactPortrait" />, "en");

    expect(screen.getByRole("link", { name: "Photo: Jose Vazquez / Unsplash" })).toHaveAttribute(
      "href",
      "https://unsplash.com/photos/Q5RBHz9cu1A",
    );
  });

  it("adds an optional caption revealed on hover", () => {
    renderWithIntl(<PhotoSlot id="heroPortrait" hoverCaption="Carlos Morais · Full-Stack" />, "en");

    expect(screen.getByText("Carlos Morais · Full-Stack")).toHaveAttribute("data-hover-caption");
  });
});
