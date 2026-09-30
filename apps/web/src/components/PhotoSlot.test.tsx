import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/render";
import { photos, type PhotoSlot as Slot } from "@/content/photos";
import { PhotoSlot } from "./PhotoSlot";

// Every slot is filled today, so empty one temporarily to exercise the placeholder.
const banner: Slot = photos.experienceBanner;
const bannerSrc = banner.src;

describe("PhotoSlot", () => {
  describe("without an image", () => {
    beforeEach(() => {
      banner.src = undefined;
    });
    afterEach(() => {
      banner.src = bannerSrc;
    });

    it("renders a labelled placeholder while the slot has no image", () => {
      renderWithIntl(<PhotoSlot id="experienceBanner" />, "en");

      expect(
        screen.getByRole("img", { name: "Modern office with computers and a city view" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Photo coming soon")).toBeInTheDocument();
    });

    it("localizes the placeholder", () => {
      renderWithIntl(<PhotoSlot id="experienceBanner" />, "pt");

      expect(
        screen.getByRole("img", {
          name: "Escritório moderno com computadores e vista para a cidade",
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
    renderWithIntl(<PhotoSlot id="aboutWorkspace" />, "en");

    expect(screen.getByRole("link", { name: "Photo: AltumCode / Unsplash" })).toHaveAttribute(
      "href",
      "https://unsplash.com/photos/PNbDkQ2DDgM",
    );
  });

  it("adds an optional caption revealed on hover", () => {
    renderWithIntl(<PhotoSlot id="heroPortrait" hoverCaption="Carlos Morais · Full-Stack" />, "en");

    expect(screen.getByText("Carlos Morais · Full-Stack")).toHaveAttribute("data-hover-caption");
  });
});
