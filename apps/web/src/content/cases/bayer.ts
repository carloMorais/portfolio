import { same, type CaseStudy } from "./types";

/**
 * From the resume and Carlos's interview answers (30/09/2026). The internal
 * transport process can't be detailed, so it stays generic.
 */
export const bayer: CaseStudy = {
  slug: "bayer",
  lead: {
    pt: "Estagiário e único desenvolvedor numa plataforma que ninguém da área dominava: aprendi Power Apps em poucos meses e entreguei três aplicações usadas de químicos do laboratório a gestores e executivos.",
    en: "An intern and the only developer on a platform nobody in the area knew: I learned Power Apps in a few months and delivered three apps used by everyone from lab chemists to managers and executives.",
  },
  facts: [
    {
      label: { pt: "Quando", en: "When" },
      value: { pt: "jun 2024 — jan 2025", en: "Jun 2024 — Jan 2025" },
    },
    {
      label: { pt: "Papel", en: "Role" },
      value: {
        pt: "Desenvolvedor Power Platform (estágio) · sozinho",
        en: "Power Platform Developer (intern) · solo",
      },
    },
    {
      label: { pt: "Onde", en: "Where" },
      value: {
        pt: "Unidade de São José dos Campos, que produz o Roundup",
        en: "São José dos Campos plant, where Roundup is made",
      },
    },
    {
      label: { pt: "Stack", en: "Stack" },
      value: same("Power Apps, Power Automate, SharePoint Lists"),
    },
  ],
  context: [
    {
      pt: "A unidade já tinha a Power Platform, mantida por uma empresa terceirizada, mas ninguém da área construía aplicações nela. As equipes sabiam o que precisavam, não como fazer.",
      en: "The plant already had the Power Platform, maintained by an outsourced company, but nobody in the area built apps on it. The teams knew what they needed, not how to build it.",
    },
  ],
  problem: [
    {
      pt: "No laboratório, a coleta de dados era manual e errava com frequência, e o time de dados recebia informação sem estrutura.",
      en: "In the lab, data collection was manual and often wrong, and the data team received unstructured information.",
    },
    {
      pt: "Ao mesmo tempo, um insumo químico de alto custo passava por várias etapas, da compra à chegada e à renovação, acompanhadas à mão. Ninguém conseguia dizer quanto tempo cada etapa levava nem onde estava o gargalo.",
      en: "At the same time, a high-cost chemical input went through several stages, from purchase to arrival to renewal, all tracked by hand. No one could say how long each stage took or where the bottleneck was.",
    },
  ],
  myPart: {
    paragraphs: [
      {
        pt: "Fiz tudo sozinho: levantei os requisitos com quem ia usar, aprendi a plataforma e construí as três aplicações.",
        en: "I did it all on my own: gathered requirements from the people who would use it, learned the platform and built the three apps.",
      },
    ],
    bullets: [
      {
        pt: "Coleta de dados de laboratório, usada nos tablets da fábrica, com validação na entrada.",
        en: "Lab data collection, used on the plant's tablets, with validation at input.",
      },
      {
        pt: "Acompanhamento de pedidos: cada pedido avança etapa por etapa, registrando estado e datas.",
        en: "Order tracking: each order moves stage by stage, recording state and dates.",
      },
      {
        pt: "Painel com gráfico de Gantt mostrando quanto tempo cada etapa levou.",
        en: "A dashboard with a Gantt chart showing how long each stage took.",
      },
    ],
  },
  decisions: [
    {
      title: { pt: "Validar na entrada, não depois", en: "Validate at input, not later" },
      paragraphs: [
        {
          pt: "O problema era o dado errado, então a validação é o ponto central do app de coleta: o formulário no tablet não aceita o que está fora do esperado, e o time de dados passa a receber tudo estruturado.",
          en: "The problem was bad data, so validation is the core of the collection app: the form on the tablet won't accept what's out of range, and the data team gets everything structured.",
        },
      ],
    },
    {
      title: { pt: "Pedido como máquina de estados", en: "An order as a state machine" },
      paragraphs: [
        {
          pt: "Cada pedido tem etapas fixas e só avança de uma para a próxima. Cada transição grava a data, e esse histórico é o que alimenta o painel, sem trabalho extra de ninguém.",
          en: "Every order has fixed stages and only moves from one to the next. Each transition records its date, and that history is what feeds the dashboard, with no extra work from anyone.",
        },
      ],
    },
    {
      title: {
        pt: "Dentro do ecossistema que já existia",
        en: "Inside the ecosystem that already existed",
      },
      paragraphs: [
        {
          pt: "Os dados ficam em SharePoint Lists e tudo roda na Power Platform da própria Bayer. Nenhuma infraestrutura nova para aprovar, pagar ou manter.",
          en: "Data lives in SharePoint Lists and everything runs on Bayer's own Power Platform. No new infrastructure to approve, pay for or maintain.",
        },
      ],
    },
    {
      title: { pt: "Gestão e visão no mesmo app", en: "Managing and viewing in one app" },
      paragraphs: [
        {
          pt: "O acompanhamento e o painel de Gantt vivem no mesmo Power Apps: quem atualiza o pedido e quem acompanha os prazos usam a mesma fonte de dados.",
          en: "Tracking and the Gantt dashboard live in the same Power Apps app: whoever updates an order and whoever watches the deadlines use the same data.",
        },
      ],
    },
  ],
  diagram: {
    left: {
      title: { pt: "Usuários", en: "Users" },
      sub: { pt: "tablet e computador", en: "tablet and desktop" },
      items: [
        { label: { pt: "Químicos do laboratório", en: "Lab chemists" } },
        { label: { pt: "Gestores e executivos", en: "Managers and executives" } },
      ],
    },
    middle: {
      title: same("Power Apps"),
      sub: same("Microsoft Power Platform"),
      items: [
        { label: { pt: "Coleta de laboratório", en: "Lab data collection" }, accent: true },
        { label: { pt: "Acompanhamento de pedidos", en: "Order tracking" } },
        { label: { pt: "Painel · gráfico de Gantt", en: "Dashboard · Gantt chart" } },
      ],
    },
    right: [
      {
        title: same("SharePoint Lists"),
        sub: { pt: "dados estruturados", en: "structured data" },
        both: true,
      },
      { title: { pt: "Time de dados", en: "Data team" }, sub: { pt: "análises", en: "analysis" } },
    ],
    links: [
      {
        row: 0,
        label: { pt: "formulário validado", en: "validated form" },
        dir: "right",
        accent: true,
      },
      { row: 1, label: { pt: "etapas e datas", en: "stages and dates" }, dir: "both" },
    ],
  },
  architecture: {
    pt: "Químicos e gestores usam os apps no tablet ou no computador. Os três apps rodam na Power Platform da Bayer e gravam em SharePoint Lists, de onde o time de dados passa a ler informação estruturada.",
    en: "Chemists and managers use the apps on a tablet or desktop. All three apps run on Bayer's Power Platform and write to SharePoint Lists, where the data team now reads structured information.",
  },
  result: [
    {
      pt: "A coleta de laboratório trocou um processo manual e sujeito a erro por um fluxo estruturado. O acompanhamento de pedidos reduziu a atualização diária de cerca de 1 hora para poucos minutos, e o gráfico de Gantt ajudou a equipe a achar os gargalos, e com isso economizar.",
      en: "Lab collection replaced a manual, error-prone process with a structured flow. Order tracking cut the daily update from about 1 hour to a few minutes, and the Gantt chart helped the team find bottlenecks, and save money as a result.",
    },
  ],
};
