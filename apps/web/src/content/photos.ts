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
 * Stock photos must carry a `credit` — it is rendered on the photo. Personal
 * projects use screenshots of the project itself (`screenshot: true`).
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
  /** A screenshot of my own project: nobody to credit. */
  screenshot?: boolean;
};

export const photos = {
  heroPortrait: {
    src: "/photos/carlos-portrait.jpg",
    ratio: "4 / 5",
    position: "50% 35%",
    alt: { pt: "Retrato de Carlos Morais, sorrindo", en: "Portrait of Carlos Morais, smiling" },
    hint: { pt: "Retrato vertical (4:5)", en: "Vertical portrait (4:5)" },
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
    src: "/photos/project-racegame-track.jpg",
    ratio: "16 / 10",
    position: "50% 50%",
    screenshot: true,
    alt: {
      pt: "O RaceGame em uma corrida de treino: a pista vista de cima, com os carros na primeira curva",
      en: "RaceGame in a practice race: the track seen from above, with the cars in the first corner",
    },
    hint: { pt: "Print do jogo em ação (16:10)", en: "Game screenshot in action (16:10)" },
  },
  projectRenova: {
    src: "/photos/project-renova-chat.jpg",
    ratio: "16 / 10",
    position: "0% 50%",
    screenshot: true,
    alt: {
      pt: "A demonstração do Renova com o preço FIPE de um Fiat Uno Mille e as chamadas de ferramenta ao lado",
      en: "The Renova demo showing the FIPE price of a Fiat Uno Mille, with the tool calls on the side",
    },
    hint: { pt: "Print da demonstração (16:10)", en: "Demo screenshot (16:10)" },
  },
  projectFoodPoint: {
    src: "/photos/project-food-point-app.jpg",
    ratio: "16 / 10",
    position: "50% 0%",
    screenshot: true,
    alt: {
      pt: "A página inicial do Food Point de 2024: “Planeje e Compartilhe Momentos de Sabor!”",
      en: "The 2024 Food Point home page: “Plan and Share Moments of Flavor!”",
    },
    hint: { pt: "Print do app (16:10)", en: "App screenshot (16:10)" },
  },
} satisfies Record<string, PhotoSlot>;

export type PhotoId = keyof typeof photos;
