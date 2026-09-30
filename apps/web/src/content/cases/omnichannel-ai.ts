import { same, type CaseStudy } from "./types";

/**
 * The company stays anonymous on the site (see context/private.md), and so do
 * its clients and partners. From the resume and Carlos's interview answers
 * (30/09/2026), at the architecture level only.
 */
export const omnichannelAi: CaseStudy = {
  slug: "omnichannel-ai",
  lead: {
    pt: "Empresas conectavam o WhatsApp delas à plataforma e passavam o contexto do negócio. A IA respondia os clientes dessas empresas, buscava dados em sistemas externos quando precisava, e as empresas disparavam campanhas para milhares de contatos.",
    en: "Companies connected their WhatsApp to the platform and gave it their business context. The AI answered those companies' customers, fetched data from external systems when needed, and the companies sent campaigns to thousands of contacts.",
  },
  facts: [
    {
      label: { pt: "Quando", en: "When" },
      value: { pt: "abr 2025 — jan 2026", en: "Apr 2025 — Jan 2026" },
    },
    {
      label: { pt: "Papel", en: "Role" },
      value: {
        pt: "Desenvolvedor de Software · full-stack",
        en: "Software Developer · full-stack",
      },
    },
    {
      label: { pt: "Escala", en: "Scale" },
      value: {
        pt: "~5 empresas · ~100 interações/dia, picos de 1.000",
        en: "~5 companies · ~100 interactions/day, peaks of 1,000",
      },
    },
    {
      label: { pt: "Stack", en: "Stack" },
      value: same("Next.js, React, NestJS, PostgreSQL, BullMQ, OpenAI, WhatsApp Cloud API"),
    },
  ],
  context: [
    {
      pt: "Uma startup de IA conversacional que vendia atendimento automatizado para outras empresas. O canal principal era o WhatsApp, pela API oficial da Meta; havia também um chat próprio e um painel de onde a equipe da empresa cliente podia falar com os clientes dela.",
      en: "A conversational AI startup selling automated customer service to other companies. The main channel was WhatsApp, through Meta's official API; there was also an in-house chat and a dashboard from which the client company's staff could talk to their own customers.",
    },
    {
      pt: "Atendíamos cerca de cinco empresas por vez, sempre com provas de conceito novas em andamento.",
      en: "We served about five companies at a time, always with new proofs of concept in progress.",
    },
  ],
  problem: [
    {
      pt: "Cada empresa tem o próprio tom, as próprias regras e os próprios sistemas. A IA precisava responder como aquela empresa, e às vezes com dados que só existem nos sistemas dela, como um pedido ou um cadastro, sem expor ao modelo mais do que o necessário.",
      en: "Each company has its own tone, rules and systems. The AI had to answer as that company, sometimes with data that only exists in its systems, like an order or an account, without exposing more to the model than needed.",
    },
    {
      pt: "E campanhas em massa no WhatsApp têm regras próprias: mensagens fora da conversa só por template aprovado, a janela de 24 horas, limites de envio e o status de entrega de cada mensagem voltando depois, por webhook.",
      en: "And bulk campaigns on WhatsApp have their own rules: messages outside a conversation only through approved templates, the 24-hour window, sending limits, and each message's delivery status coming back later by webhook.",
    },
  ],
  myPart: {
    paragraphs: [
      {
        pt: "Trabalhei nas duas pontas, frontend e backend, e peguei problemas de DevOps quando foi preciso. Quando cheguei, a integração com o WhatsApp já estava sendo construída: dei manutenção nos webhooks e no envio de mensagens. O sistema de campanhas eu construí do zero.",
        en: "I worked on both ends, frontend and backend, and took on DevOps problems when needed. When I joined, the WhatsApp integration was already being built: I maintained the webhooks and outgoing messages. The campaign system I built from scratch.",
      },
    ],
    bullets: [
      {
        pt: "Campanhas: importação de planilha, disparo em massa em segundo plano e status de entrega por contato.",
        en: "Campaigns: spreadsheet import, background bulk sending and per-contact delivery status.",
      },
      {
        pt: "Manutenção dos webhooks de mensagens e do envio de respostas pelo WhatsApp.",
        en: "Maintenance of the message webhooks and of replies sent over WhatsApp.",
      },
      {
        pt: "Participação nos servidores MCP que ligavam a IA a mais de 10 APIs externas.",
        en: "Work on the MCP servers connecting the AI to 10+ external APIs.",
      },
      {
        pt: "Apoio ao sistema de IA configurável por empresa: atendimento, geração de leads e automação de fluxos.",
        en: "Support on the per-company configurable AI: customer service, lead generation and workflow automation.",
      },
    ],
  },
  decisions: [
    {
      title: { pt: "Tudo começa num webhook", en: "Everything starts with a webhook" },
      paragraphs: [
        {
          pt: "A Meta entrega cada mensagem recebida por webhook. O backend identifica a empresa, monta a resposta com o contexto dela e responde pela API oficial. A IA levava de 10 segundos a um minuto por resposta.",
          en: "Meta delivers every incoming message by webhook. The backend identifies the company, builds the reply with its context and answers through the official API. The AI took 10 seconds to a minute per reply.",
        },
      ],
    },
    {
      title: {
        pt: "Campanha é um job longo e controlado",
        en: "A campaign is one long, paced job",
      },
      paragraphs: [
        {
          pt: "A planilha importada vira um único job na fila (BullMQ) com todos os destinatários. Ele envia com alguns segundos de intervalo, grava cada envio no banco e segue para o próximo. Os webhooks de status marcam depois quem recebeu e quem não recebeu.",
          en: "The imported spreadsheet becomes a single queued job (BullMQ) with every recipient. It sends a few seconds apart, records each send in the database and moves on. Status webhooks later mark who got it and who didn't.",
        },
        {
          pt: "Os templates de marketing saem pela Marketing Messages Lite API da Meta, feita para esse tipo de envio.",
          en: "Marketing templates go out through Meta's Marketing Messages Lite API, built for this kind of send.",
        },
      ],
    },
    {
      title: { pt: "A janela de 24 horas no banco", en: "The 24-hour window in the database" },
      paragraphs: [
        {
          pt: "A última interação de cada contato fica registrada. Dentro da janela, a resposta é livre; fora dela, só por template, e o template reabre a janela para a conversa continuar.",
          en: "Each contact's last interaction is recorded. Inside the window, replies are free-form; outside it, only templates, and a template reopens the window so the conversation can go on.",
        },
      ],
    },
    {
      title: { pt: "MCP num serviço separado", en: "MCP as a separate service" },
      paragraphs: [
        {
          pt: "Quando começamos, o MCP ainda era novo e não havia servidores prontos para o que precisávamos. Para cada API externa, estudávamos o formato dela e escrevíamos as ferramentas num serviço MCP próprio, em outro servidor: o backend fala com ele pela rede, e a lógica de cada integração fica fora do motor de conversa.",
          en: "When we started, MCP was still new and there were no ready-made servers for what we needed. For each external API, we studied its shape and wrote the tools in our own MCP service, on a separate server: the backend talks to it over the network, and each integration's logic stays out of the conversation engine.",
        },
      ],
    },
    {
      title: {
        pt: "A IA não escolhe de quem são os dados",
        en: "The AI doesn't choose whose data it gets",
      },
      paragraphs: [
        {
          pt: "Quem está falando já é conhecido pelo número do WhatsApp. As ferramentas usam esse número, enviado nos headers, para buscar os dados nas APIs; o modelo recebe só o necessário para responder, e dados sensíveis ficam de fora do prompt.",
          en: "Who's talking is already known from the WhatsApp number. The tools use that number, sent in headers, to fetch data from the APIs; the model gets only what it needs to answer, and sensitive data stays out of the prompt.",
        },
      ],
    },
  ],
  diagram: {
    left: {
      title: { pt: "Canais", en: "Channels" },
      sub: { pt: "Meta e painel web", en: "Meta and web dashboard" },
      items: [
        { label: same("WhatsApp · Cloud API") },
        { label: { pt: "Painel (Next.js)", en: "Dashboard (Next.js)" } },
        { label: { pt: "MM Lite · campanhas", en: "MM Lite · campaigns" } },
      ],
    },
    middle: {
      title: same("Backend"),
      sub: same("NestJS"),
      items: [
        { label: { pt: "Webhooks e respostas", en: "Webhooks & replies" } },
        { label: { pt: "Motor de conversa", en: "Conversation engine" }, accent: true },
        { label: { pt: "Campanhas · BullMQ", en: "Campaigns · BullMQ" } },
        { label: { pt: "Cliente MCP", en: "MCP client" } },
      ],
    },
    right: [
      { title: same("PostgreSQL"), sub: { pt: "conversas e envios", en: "chats and sends" } },
      { title: same("Redis"), sub: { pt: "filas do BullMQ", en: "BullMQ queues" } },
      { title: same("OpenAI"), sub: { pt: "respostas da IA", en: "AI replies" }, both: true },
      {
        title: { pt: "Serviço MCP", en: "MCP service" },
        sub: { pt: "10+ APIs externas", en: "10+ external APIs" },
        both: true,
      },
    ],
    links: [
      { row: 0, label: { pt: "mensagens", en: "messages" }, dir: "both" },
      { row: 1, label: same("HTTPS"), dir: "both" },
      { row: 2, label: { pt: "disparos", en: "sends" }, dir: "left", accent: true },
    ],
  },
  architecture: {
    pt: "As mensagens chegam da Meta por webhook e o motor de conversa responde com o contexto da empresa, consultando a OpenAI e o serviço MCP, que roda em outro servidor e fala com as APIs externas. As campanhas passam por uma fila BullMQ e saem pela API de marketing da Meta.",
    en: "Messages arrive from Meta by webhook and the conversation engine replies with the company's context, calling OpenAI and the MCP service, which runs on a separate server and talks to external APIs. Campaigns go through a BullMQ queue and out through Meta's marketing API.",
  },
  result: [
    {
      pt: "A plataforma atendia cerca de cinco empresas, com uns 100 atendimentos por dia no total e picos de 1.000 mensagens. O sistema de campanhas que construí do zero entrou em uso para as empresas dispararem para listas inteiras de contatos.",
      en: "The platform served about five companies, with around 100 conversations a day in total and peaks of 1,000 messages. The campaign system I built from scratch went into use, letting companies send to whole contact lists.",
    },
  ],
};
