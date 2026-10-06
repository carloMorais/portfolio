import type { Locale } from "@/i18n/routing";

/**
 * Career data, transcribed from the resumes in `context/curriculo/`.
 * Keep every claim traceable to them; content-rules.test.ts guards the rules.
 */
export type Localized = Record<Locale, string>;

/** "YYYY-MM" */
type YearMonth = `${number}-${string}`;

export type Job = {
  id: string;
  company: Localized;
  role: Localized;
  start: YearMonth;
  /** null = current position */
  end: YearMonth | null;
  location: Localized;
  workMode: Localized;
  summary: Localized;
  highlights: Localized[];
  tags: string[];
};

export const jobs: Job[] = [
  {
    id: "plumaa",
    company: { pt: "Plumaa", en: "Plumaa" },
    role: { pt: "Desenvolvedor Full-Stack", en: "Full-Stack Developer" },
    start: "2026-01",
    end: null,
    location: { pt: "São Paulo, Brasil", en: "São Paulo, Brazil" },
    workMode: { pt: "Remoto", en: "Remote" },
    summary: {
      pt: "SaaS B2B/B2C com ~100 contas ativas, entre clientes, psicólogos e empresas.",
      en: "B2B/B2C SaaS with ~100 active accounts across clients, psychologists and companies.",
    },
    highlights: [
      {
        pt: "Atuo como referência técnica para uma squad de 2 a 3 desenvolvedores menos experientes, apoiando decisões de arquitetura e revisão de código.",
        en: "Act as technical reference for a squad of 2 to 3 less experienced developers, supporting architecture decisions and code review.",
      },
      {
        pt: "Arquitetei sistema multi-tenant com RBAC de 5 níveis, garantindo isolamento seguro entre perfis de usuários.",
        en: "Architected a multi-tenant system with 5-level RBAC, ensuring secure isolation between user roles.",
      },
      {
        pt: "Integrei Stripe para gestão de assinaturas e controle de acesso a funcionalidades por plano, além de Google Calendar e Google OAuth para agendamento de consultas entre clientes e psicólogos.",
        en: "Integrated Stripe to handle subscriptions and plan-based feature access, plus Google Calendar and Google OAuth so customers could book appointments with psychologists directly through the platform.",
      },
      {
        pt: "Desenvolvi pipeline de IA de transcrição e resumo de sessão, validado com usuários, que substitui a escrita manual de prontuários e economiza entre 3 e 8 horas semanais por psicólogo.",
        en: "Developed a user-validated AI pipeline for session transcription and summaries that replaces writing notes by hand, saving psychologists 3 to 8 hours a week.",
      },
      {
        pt: "Configurei deploy e infraestrutura na Digital Ocean (App Platform) com containers Docker em produção e frontend na Vercel, com staging espelhando a produção, backup diário do banco e testes automatizados rodados antes de cada deploy.",
        en: "Set up deployment and infrastructure on Digital Ocean (App Platform) with Docker containers in production and the frontend on Vercel, with staging mirroring production, daily database backups and automated tests run before every deploy.",
      },
    ],
    tags: [
      "Multi-tenant",
      "RBAC",
      "Stripe",
      "Google Calendar",
      "Google OAuth",
      "AI",
      "Docker",
      "Digital Ocean",
      "Jest",
      "Playwright",
    ],
  },
  {
    // Company name intentionally omitted on the site (see context/private.md).
    id: "ai-startup",
    company: { pt: "Startup de IA conversacional", en: "Conversational AI startup" },
    role: { pt: "Desenvolvedor de Software", en: "Software Developer" },
    start: "2025-04",
    end: "2026-01",
    location: { pt: "São Paulo, Brasil", en: "São Paulo, Brazil" },
    workMode: { pt: "Remoto", en: "Remote" },
    summary: {
      pt: "Plataforma omnichannel com IA para atendimento, geração de leads e automação.",
      en: "AI-powered omnichannel platform for customer support, lead generation and automation.",
    },
    highlights: [
      {
        pt: "Desenvolvi e mantive uma plataforma omnichannel com IA conectando WhatsApp Business e um canal interno, processando ~100 interações diárias.",
        en: "Built and maintained an AI-powered omnichannel platform connecting WhatsApp Business and an internal channel, processing ~100 daily interactions.",
      },
      {
        pt: "Contribuí na integração da API oficial do WhatsApp Business (Meta) para atendimento, geração de leads e campanhas via IA.",
        en: "Contributed to the integration of the Meta WhatsApp Business API for customer support, lead nurturing, and AI-driven campaigns.",
      },
      {
        pt: "Participei da orquestração de mais de 10 APIs externas (Monday, Neeto e sistemas proprietários de clientes) via MCP, habilitando controle de ferramentas externas por chat.",
        en: "Took part in orchestrating 10+ external APIs (Monday, Neeto, and proprietary client systems) via MCP, enabling chat-based control of external tools.",
      },
      {
        pt: "Apoiei a construção de um sistema de IA customizável para múltiplos cenários: atendimento ao cliente, geração de leads e automação de fluxos operacionais.",
        en: "Supported the development of a customizable AI system for multiple use cases: customer support, lead generation, and operational workflow automation.",
      },
    ],
    tags: ["WhatsApp Business API", "MCP", "AI", "API integrations"],
  },
  {
    id: "bayer",
    company: { pt: "Bayer", en: "Bayer" },
    role: {
      pt: "Desenvolvedor Power Platform (Estágio)",
      en: "Power Platform Developer (Internship)",
    },
    start: "2024-06",
    end: "2025-01",
    location: { pt: "São José dos Campos, Brasil", en: "São José dos Campos, Brazil" },
    workMode: { pt: "Híbrido", en: "Hybrid" },
    summary: {
      pt: "Digitalização de processos de produção e transporte.",
      en: "Digitizing production and transportation processes.",
    },
    highlights: [
      {
        pt: "Desenvolvi 3 aplicações em PowerApps e Power Automate para digitalizar processos de produção e transporte.",
        en: "Built 3 applications in PowerApps and Power Automate to digitize production and transportation processes.",
      },
      {
        pt: "Criei solução de coleta de dados laboratoriais que substituiu um processo manual e passível de erros por um fluxo estruturado, eliminando gargalos e agilizando a operação da equipe.",
        en: "Created a lab data collection solution that replaced an error-prone manual process with a structured workflow, removing bottlenecks and speeding up team operations.",
      },
      {
        pt: "Desenvolvi dashboard de gestão de transporte que reduziu o tempo de atualização diária de ~1 hora para poucos minutos.",
        en: "Developed a transportation management dashboard that reduced daily data-update time from ~1 hour to a few minutes.",
      },
    ],
    tags: ["Power Apps", "Power Automate", "Dashboards"],
  },
];

export type Education = {
  id: string;
  title: Localized;
  institution: Localized;
  start: YearMonth;
  end: YearMonth;
  /** true = still studying; `end` is the expected completion date */
  inProgress?: boolean;
  details: Localized;
};

export const education: Education[] = [
  {
    id: "ifrs",
    title: { pt: "Administrador de Banco de Dados", en: "Database Administration" },
    institution: {
      pt: "Instituto Federal do Rio Grande do Sul (IFRS)",
      en: "Federal Institute of Rio Grande do Sul (IFRS)",
    },
    start: "2026-08",
    end: "2027-01",
    inProgress: true,
    details: {
      pt: "200h · Conceitos de banco de dados, SQL, administração e prática em PostgreSQL e MySQL.",
      en: "200h · Database fundamentals, SQL, and hands-on administration with PostgreSQL and MySQL.",
    },
  },
  {
    id: "alpha",
    title: { pt: "Formação Full-Stack", en: "Full-Stack Development Program" },
    institution: { pt: "Alpha EdTech", en: "Alpha EdTech" },
    start: "2023-11",
    end: "2025-04",
    details: {
      pt: "Code academy sem fins lucrativos, em tempo integral (8h/dia), com projetos reais. ~3.000h práticas em React, Node.js, PostgreSQL, Linux e soft skills — base para os 3 empregos conquistados na área.",
      en: "A non-profit, full-time (8h/day) code academy built on real projects. ~3,000 hours of hands-on practice in React, Node.js, PostgreSQL, Linux and soft skills — foundation for the 3 jobs held in the field so far.",
    },
  },
  {
    id: "alura",
    title: {
      pt: "JavaScript, TypeScript, Angular, HTML & CSS",
      en: "JavaScript, TypeScript, Angular, HTML & CSS",
    },
    institution: { pt: "Alura", en: "Alura" },
    start: "2022-04",
    end: "2023-04",
    details: { pt: "Cursos online.", en: "Online courses." },
  },
];

export const languages: { name: Localized; level: Localized }[] = [
  { name: { pt: "Português", en: "Portuguese" }, level: { pt: "Nativo", en: "Native" } },
  {
    name: { pt: "Inglês", en: "English" },
    level: {
      pt: "Leitura técnica: intermediário · Conversação: básico",
      en: "Technical reading: intermediate · Speaking: basic",
    },
  },
];

export const volunteering: { org: string; items: Localized[] } = {
  org: "Instituto Alpha Lumen",
  items: [
    {
      pt: "Avaliador — OBT (jun/2024): avaliação de 15+ projetos mobile/UX-UI.",
      en: "Evaluator — OBT (Jun 2024): assessed 15+ mobile/UX-UI projects.",
    },
    {
      pt: "Gestão — Semana EAT (2024–2025): coordenação de ~150 alunos e mentoria de pitch.",
      en: "Coordinator — Semana EAT (2024–2025): coordinated ~150 students and mentored pitch presentations.",
    },
  ],
};

export const skillGroups: { title: Localized; items: string[] }[] = [
  {
    title: { pt: "Front-end", en: "Front-end" },
    items: [
      "React",
      "Next.js",
      "TypeScript",
      "JavaScript (ES6+)",
      "Vite",
      "Tailwind CSS",
      "HTML5",
      "CSS3",
    ],
  },
  {
    title: { pt: "Back-end", en: "Back-end" },
    items: ["Node.js", "NestJS", "Express", "REST APIs", "Webhooks", "WebSocket", "BullMQ"],
  },
  {
    title: { pt: "Banco de dados", en: "Databases" },
    items: ["PostgreSQL", "Prisma", "Redis", "Data modeling"],
  },
  {
    title: { pt: "Testes & DevOps", en: "Testing & DevOps" },
    items: ["Jest", "Playwright", "GitHub Actions", "Docker", "Digital Ocean", "Vercel"],
  },
  {
    title: { pt: "Integrações & IA", en: "Integrations & AI" },
    items: [
      "Stripe",
      "Google Calendar",
      "Google OAuth",
      "MCP",
      "Generative AI pipelines",
      "WhatsApp Business API",
    ],
  },
];

/**
 * Headline numbers, all from the resume. The resume says "~100 active clients";
 * the site says accounts, as the Plumaa case study does: the ~100 add up
 * clients, psychologists, companies and their employees.
 */
export const stats: { value: string; label: Localized }[] = [
  { value: "2+", label: { pt: "anos entregando em produção", en: "years shipping to production" } },
  {
    value: "~100",
    label: {
      pt: "contas ativas na plataforma em que trabalho hoje",
      en: "active accounts on the platform I currently work on",
    },
  },
  {
    value: "3–8h",
    label: {
      pt: "semanais economizadas por psicólogo com IA",
      en: "saved per psychologist weekly with AI",
    },
  },
];

export const cvFiles: Record<Locale, string> = {
  pt: "/cv/Carlos_Morais_CV_PT.pdf",
  en: "/cv/Carlos_Morais_CV_EN.pdf",
};
