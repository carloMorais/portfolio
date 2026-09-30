import type { Localized } from "./career";
import type { PhotoId } from "./photos";

export type WorkItem = {
  slug: string;
  kind: "case" | "project";
  /** Page exists and can be linked. Cards stay visible but unlinked until then. */
  ready: boolean;
  context: Localized;
  period: Localized;
  title: Localized;
  blurb: Localized;
  tags: string[];
  photo: PhotoId;
  repo?: string;
};

export const work: WorkItem[] = [
  {
    slug: "plumaa",
    kind: "case",
    ready: true,
    context: { pt: "Plumaa", en: "Plumaa" },
    period: { pt: "2026 — atual", en: "2026 — present" },
    title: {
      pt: "Plataforma de saúde mental para pessoas, psicólogos e empresas",
      en: "A mental health platform for people, psychologists and companies",
    },
    blurb: {
      pt: "Backend construído do zero: cinco perfis de acesso, pagamentos com Stripe, agenda com Google Calendar, NR-1 para empresas e resumo de sessão com IA que economiza de 3 a 8 horas semanais por psicólogo.",
      en: "A backend built from scratch: five access profiles, Stripe payments, Google Calendar scheduling, NR-1 for companies and an AI session summary that saves psychologists 3 to 8 hours a week.",
    },
    tags: ["NestJS", "PostgreSQL", "Stripe", "Google OAuth", "Claude"],
    photo: "casePlumaa",
  },
  {
    slug: "omnichannel-ai",
    kind: "case",
    ready: true,
    context: { pt: "Startup de IA conversacional", en: "Conversational AI startup" },
    period: { pt: "2025 — 2026", en: "2025 — 2026" },
    title: {
      pt: "Plataforma omnichannel com IA e WhatsApp",
      en: "An AI omnichannel platform on WhatsApp",
    },
    blurb: {
      pt: "Atendimento com IA no WhatsApp para outras empresas: ~100 interações por dia, ferramentas ligadas a mais de 10 APIs externas e um sistema de campanhas em massa que construí do zero.",
      en: "AI customer service on WhatsApp for other companies: ~100 interactions a day, tools wired to 10+ external APIs and a bulk campaign system I built from scratch.",
    },
    tags: ["WhatsApp Business API", "MCP", "BullMQ", "OpenAI"],
    photo: "caseOmnichannel",
  },
  {
    slug: "bayer",
    kind: "case",
    ready: true,
    context: { pt: "Bayer", en: "Bayer" },
    period: { pt: "2024 — 2025", en: "2024 — 2025" },
    title: {
      pt: "Laboratório e pedidos digitalizados na Power Platform",
      en: "Digitizing lab and order processes on the Power Platform",
    },
    blurb: {
      pt: "3 aplicações feitas sozinho: coleta de laboratório com validação, acompanhamento de pedidos e um painel de Gantt, com a atualização diária caindo de ~1 hora para poucos minutos.",
      en: "3 apps built solo: validated lab data collection, order tracking and a Gantt dashboard, with the daily update dropping from ~1 hour to a few minutes.",
    },
    tags: ["Power Apps", "Power Automate", "SharePoint"],
    photo: "caseBayer",
  },
  {
    slug: "racegame",
    kind: "project",
    ready: true,
    context: { pt: "Projeto de curso · Líder do projeto", en: "Capstone project · Team lead" },
    period: { pt: "nov 2024", en: "Nov 2024" },
    title: {
      pt: "RaceGame: corrida multiplayer em tempo real",
      en: "RaceGame: real-time multiplayer racing",
    },
    blurb: {
      pt: "Até 10 corredores numa pista top-down em Canvas, com o servidor como fonte da verdade e predição no cliente, sincronizados por WebSocket, sem Socket.IO.",
      en: "Up to 10 racers on a top-down Canvas track, with the server as the source of truth and client-side prediction, synced over WebSocket, no Socket.IO.",
    },
    tags: ["HTML5 Canvas", "React", "Express", "WebSocket"],
    photo: "projectRacegame",
    repo: "https://github.com/Projeto-Ciclo-2/RaceGame",
  },
];
