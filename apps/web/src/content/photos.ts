import type { Locale } from "@/i18n/routing";

export type PhotoCredit = {
  author: string;
  source: "Unsplash" | "Pexels";
  /** The photo's page on the source site. */
  url: string;
};

/**
 * Every photo on the site is a named slot. To fill one, drop an optimized
 * image (≤ 2400px, no EXIF) in `public/photos/` and set `src`.
 * Slots without `src` render an elegant placeholder instead.
 * Stock photos must carry a `credit` — it is rendered on the photo.
 */
export type PhotoSlot = {
  src?: string;
  /** CSS aspect-ratio, e.g. "4 / 5". */
  ratio: string;
  /** CSS object-position used to crop the image into `ratio`. */
  position?: string;
  alt: Record<Locale, string>;
  /** What should go here — shown on the placeholder while it is empty. */
  hint: Record<Locale, string>;
  credit?: PhotoCredit;
};

export const photos = {
  heroPortrait: {
    src: "/photos/carlos-portrait.jpg",
    ratio: "4 / 5",
    position: "50% 35%",
    alt: { pt: "Retrato de Carlos Morais, sorrindo", en: "Portrait of Carlos Morais, smiling" },
    hint: { pt: "Retrato vertical (4:5)", en: "Vertical portrait (4:5)" },
  },
  aboutWorkspace: {
    src: "/photos/about-workspace.jpg",
    ratio: "4 / 5",
    position: "50% 55%",
    alt: {
      pt: "Notebook com código aberto ao lado de uma pilha de livros",
      en: "Laptop showing code next to a stack of books",
    },
    hint: {
      pt: "Você trabalhando / seu setup (4:5)",
      en: "You at work / your setup (4:5)",
    },
    credit: {
      author: "AltumCode",
      source: "Unsplash",
      url: "https://unsplash.com/photos/PNbDkQ2DDgM",
    },
  },
  contactPortrait: {
    src: "/photos/contact-meeting.jpg",
    ratio: "4 / 3",
    position: "55% 50%",
    alt: {
      pt: "Duas pessoas conversando em frente a um notebook",
      en: "Two people talking in front of a laptop",
    },
    hint: { pt: "Foto horizontal (4:3)", en: "Landscape photo (4:3)" },
    credit: {
      author: "Jose Vazquez",
      source: "Unsplash",
      url: "https://unsplash.com/photos/Q5RBHz9cu1A",
    },
  },
  experienceBanner: {
    src: "/photos/experience-banner.jpg",
    ratio: "21 / 9",
    position: "50% 62%",
    alt: {
      pt: "Escritório moderno com computadores e vista para a cidade",
      en: "Modern office with computers and a city view",
    },
    credit: {
      author: "Dextar Studio",
      source: "Pexels",
      url: "https://www.pexels.com/photo/15599164/",
    },
    hint: {
      pt: "Foto horizontal larga: evento, time ou escritório (21:9)",
      en: "Wide landscape: event, team or office (21:9)",
    },
  },
  casePlumaa: {
    src: "/photos/case-plumaa.jpg",
    ratio: "16 / 10",
    position: "50% 30%",
    alt: {
      pt: "Mulher sorrindo em uma chamada de vídeo pelo notebook",
      en: "Woman smiling on a video call on her laptop",
    },
    hint: {
      pt: "Capa: tela do produto sem dados reais (16:10)",
      en: "Cover: product screen, no real data (16:10)",
    },
    credit: {
      author: "Karola G",
      source: "Pexels",
      url: "https://www.pexels.com/photo/5908778/",
    },
  },
  caseOmnichannel: {
    src: "/photos/case-omnichannel.jpg",
    ratio: "16 / 10",
    position: "50% 50%",
    alt: {
      pt: "Celular sobre uma mesa de madeira mostrando uma conversa de chat",
      en: "Phone on a wooden table showing a chat conversation",
    },
    hint: {
      pt: "Capa sem marca da empresa (16:10)",
      en: "Cover without company branding (16:10)",
    },
    credit: {
      author: "Brett Wharton",
      source: "Unsplash",
      url: "https://unsplash.com/photos/XbrUCn3nLGQ",
    },
  },
  caseBayer: {
    src: "/photos/case-bayer.jpg",
    ratio: "16 / 10",
    position: "50% 42%",
    alt: {
      pt: "Pessoa trabalhando em uma planilha no notebook, com anotações em papel",
      en: "Person working on a spreadsheet on a laptop, holding handwritten notes",
    },
    hint: {
      pt: "Capa: foto do período ou ilustração (16:10)",
      en: "Cover: photo from that time or illustration (16:10)",
    },
    credit: {
      author: "Surface",
      source: "Unsplash",
      url: "https://unsplash.com/photos/DMVU0XqiT90",
    },
  },
  projectRacegame: {
    src: "/photos/project-racegame.jpg",
    ratio: "16 / 10",
    position: "50% 62%",
    alt: {
      pt: "Carrinhos em miniatura sobre um tapete com pista de corrida",
      en: "Miniature cars on a race track desk mat",
    },
    hint: { pt: "Print do jogo em ação (16:10)", en: "Game screenshot in action (16:10)" },
    credit: {
      author: "I'M ZION",
      source: "Unsplash",
      url: "https://unsplash.com/photos/ybQcEX5zcNQ",
    },
  },
} satisfies Record<string, PhotoSlot>;

export type PhotoId = keyof typeof photos;
