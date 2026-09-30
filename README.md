# Carlos Morais — Portfolio

Bilingual (PT/EN) portfolio of **Carlos Eduardo Araujo Morais**, Full-Stack Developer. Case studies, career and projects, all on one site.

**Live:** [portfolio-carlomorais.vercel.app](https://portfolio-carlomorais.vercel.app)

> 🇧🇷 Portfólio bilíngue de Carlos Morais, Desenvolvedor Full-Stack. O código das empresas é privado, então cada estudo de caso mostra o problema, as decisões técnicas, a arquitetura e o resultado, sem expor lógica ou dados de clientes. O site em si é público e testado de ponta a ponta.

## What's inside

- **Home** with an animated architecture graph in the margins: every phrase typed in the "user" input becomes a request travelling React → Next.js → NestJS → Prisma → PostgreSQL (or ioredis → Redis) and back.
- **Case studies** for each role (a mental health SaaS, a conversational AI platform on WhatsApp, Power Platform apps at Bayer) and a capstone project (RaceGame, a real-time multiplayer racing game). Each one follows the same arc: context → problem → my part → technical decisions → architecture diagram → outcome.
- **Experience** page and downloadable resume (PDF) in both languages.

## Stack

| Area      | Tools                                                                           |
| --------- | ------------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript                        |
| Styling   | Tailwind CSS v4, design tokens with light/dark themes, Fraunces + Geist fonts   |
| i18n      | next-intl, locale-prefixed routes (`/pt`, `/en`), typed messages                |
| Testing   | Jest + Testing Library, Playwright (desktop + mobile) with axe accessibility    |
| Quality   | ESLint, Prettier, GitHub Actions CI                                             |
| SEO       | Canonical + hreflang on every page, sitemap, robots, generated Open Graph image |

## Running locally

Requires Node.js 24 (see `.nvmrc`). Everything runs from the repository root:

```bash
npm install
npm run dev          # http://localhost:17000
```

| Command             | What it does                                                 |
| ------------------- | ------------------------------------------------------------ |
| `npm run build`     | Production build                                             |
| `npm run lint`      | ESLint                                                       |
| `npm run typecheck` | TypeScript, no emit                                          |
| `npm test`          | Jest (components and logic)                                  |
| `npm run test:e2e`  | Playwright: builds, starts on port 17001 and runs every spec |
| `npm run format`    | Prettier (CI runs `format:check`)                            |

Set `NEXT_PUBLIC_SITE_URL` to the public origin for canonical URLs and the sitemap. On Vercel, the production domain is used automatically.

## Project structure

```
apps/web/
├── messages/            UI strings (pt.json, en.json), typed from en.json
├── public/              photos, resume PDFs, RaceGame clip
├── e2e/                 Playwright specs
└── src/
    ├── app/[locale]/    pages (the locale layout is the root layout)
    ├── components/      UI, hero graph, case study layout and diagrams
    ├── content/         career data, work cards, case studies ({ pt, en } inline)
    ├── i18n/            next-intl routing and request config
    └── lib/             SEO helpers, dates, tabs, age
```

## Tests as guardrails

Besides unit and end-to-end tests, a set of **content rules** runs in CI (`src/content/content-rules.test.ts`). They fail the build if the public text states something that isn't true or isn't allowed: wrong employment dates, a job title the author doesn't hold, a course shown as finished while still in progress, a stock photo without credit, or the name of an employer that must stay anonymous. The site is meant to hold up in a technical interview, so honesty is tested like any other feature.

The E2E suite checks every page in both languages for accessibility violations (axe), horizontal scroll, broken internal links and SEO tags.

## Working with AI

This project is built with [Claude Code](https://claude.com/claude-code) as a pair programmer, with the content rules above as tests so that nothing unverified reaches the site.

## Contact

[LinkedIn](https://www.linkedin.com/in/carlos-m-678974245) · [GitHub](https://github.com/carloMorais) · carlos13bem@gmail.com
