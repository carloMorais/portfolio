import { same, type CaseStudy } from "./types";

/**
 * From the resume and Carlos's interview answers (30/09/2026). Company code and
 * logic are protected, so this stays at the architecture level. Partner names
 * are confidential.
 */
export const plumaa: CaseStudy = {
  slug: "plumaa",
  lead: {
    pt: "Entrei quando a Plumaa ainda era só uma ideia. Escolhi a stack, modelei o banco e construí o backend de uma plataforma de saúde mental com três públicos: pessoas que buscam terapia, psicólogos e empresas.",
    en: "I joined when Plumaa was still just an idea. I picked the stack, designed the database and built the backend of a mental health platform with three audiences: people looking for therapy, psychologists and companies.",
  },
  facts: [
    {
      label: { pt: "Quando", en: "When" },
      value: { pt: "jan 2026 — atual", en: "Jan 2026 — present" },
    },
    {
      label: { pt: "Papel", en: "Role" },
      value: {
        pt: "Desenvolvedor Full-Stack · único dev de backend",
        en: "Full-Stack Developer · sole backend developer",
      },
    },
    {
      label: { pt: "Time", en: "Team" },
      value: { pt: "até 3 devs", en: "up to 3 developers" },
    },
    {
      label: { pt: "Stack", en: "Stack" },
      value: same(
        "React (Vite), NestJS, Prisma, PostgreSQL, Graphile Worker, Stripe, Google APIs, Claude, Deepgram",
      ),
    },
  ],
  context: [
    {
      pt: "A Plumaa é uma plataforma de saúde mental. Pessoas compram sessões avulsas ou planos para fazer terapia com psicólogos parceiros; psicólogos gerenciam agenda e atendimentos; e empresas usam um produto separado para mapear riscos psicossociais, como pede a norma NR-1.",
      en: "Plumaa is a mental health platform. People buy single sessions or plans to see partner psychologists; psychologists manage their schedule and sessions; and companies use a separate product to map psychosocial risks, as required by Brazil's NR-1 workplace regulation.",
    },
    {
      pt: "É uma startup pequena: o time técnico chegou a no máximo três pessoas. Hoje são cerca de 100 contas ativas, somando clientes, psicólogos, empresas e funcionários dessas empresas.",
      en: "It's a small startup: the tech team peaked at three people. Today there are about 100 active accounts across clients, psychologists, companies and their employees.",
    },
  ],
  problem: [
    {
      pt: "Um único backend precisava servir cinco perfis com visões muito diferentes dos mesmos dados, e parte desses dados é de saúde. Um psicólogo não pode ver o que é de outro, uma empresa não pode ver as respostas individuais dos funcionários, e ninguém fora do admin pode chegar perto do resto.",
      en: "A single backend had to serve five profiles with very different views of the same data, and some of that data is health data. A psychologist can't see another's data, a company can't see its employees' individual answers, and no one but the admin can get near the rest.",
    },
    {
      pt: "Além disso: cobrança de sessões e assinaturas, agenda entre fusos horários, e psicólogos gastando horas por semana escrevendo prontuários à mão depois das sessões. Tudo com um time mínimo e na velocidade de uma startup.",
      en: "On top of that: billing for sessions and subscriptions, scheduling across time zones, and psychologists spending hours a week writing session notes by hand. All with a tiny team, at startup speed.",
    },
  ],
  myPart: {
    paragraphs: [
      {
        pt: "Fui o único desenvolvedor de backend. Escolhi a stack, modelei o banco de dados e a estratégia de acesso e armazenamento, e ajudei a montar o time, conduzindo as entrevistas técnicas. O frontend ficou com os outros devs; eu revisava as entregas no staging e repassava cada mudança da API com a documentação do Swagger.",
        en: "I was the only backend developer. I chose the stack, designed the database and the access and storage strategy, and helped build the team by running the technical interviews. The other developers owned the frontend; I reviewed their work on staging and handed over every API change with its Swagger docs.",
      },
    ],
    bullets: [
      {
        pt: "Controle de acesso dos cinco perfis: cliente, psicólogo, empresa, funcionário e admin.",
        en: "Access control for the five profiles: client, psychologist, company, employee and admin.",
      },
      {
        pt: "Pagamentos com Stripe: sessões avulsas, planos com benefícios e a assinatura das empresas.",
        en: "Stripe payments: single sessions, plans with benefits and company subscriptions.",
      },
      {
        pt: "Agenda com Google Calendar e login com Google.",
        en: "Scheduling with Google Calendar and sign-in with Google.",
      },
      {
        pt: "Produto B2B de NR-1: questionário por link público com validação de acesso e o cálculo dos riscos no banco.",
        en: "The NR-1 B2B product: a questionnaire shared by public link with access checks, and the risk scoring in the database.",
      },
      {
        pt: "Pipeline de IA que transcreve a sessão e gera o rascunho do prontuário.",
        en: "An AI pipeline that transcribes the session and drafts the clinical notes.",
      },
      {
        pt: "Registro de eventos do sistema (sessão iniciada, transcrição iniciada, pagamento feito) para o painel do admin.",
        en: "A system event log (session started, transcription started, payment made) for the admin dashboard.",
      },
      {
        pt: "Testes unitários e de integração cobrindo todas as rotas e serviços do backend.",
        en: "Unit and integration tests covering every backend route and service.",
      },
      {
        pt: "Infraestrutura: backend e banco na Digital Ocean, frontend na Vercel, staging espelhando a produção.",
        en: "Infrastructure: backend and database on Digital Ocean, frontend on Vercel, staging mirroring production.",
      },
    ],
  },
  decisions: [
    {
      title: { pt: "Permissão sempre no backend", en: "Permissions always on the backend" },
      paragraphs: [
        {
          pt: "O cookie de sessão diz quem é o usuário e qual o perfil dele. Antes de qualquer consulta chegar ao repositório, uma camada define quais tabelas e colunas aquele perfil pode ler. O que está fora disso responde 404, sem nem confirmar que o recurso existe.",
          en: "The session cookie says who the user is and which profile they have. Before any query reaches the repository, a layer decides which tables and columns that profile may read. Anything outside it returns 404, without even confirming the resource exists.",
        },
      ],
    },
    {
      title: { pt: "Postgres para tudo, sem Redis", en: "Postgres for everything, no Redis" },
      paragraphs: [
        {
          pt: "As tarefas em segundo plano rodam no Graphile Worker, uma fila guardada no próprio PostgreSQL. Com a carga de hoje, é um serviço a menos para pagar, monitorar e manter no ar.",
          en: "Background jobs run on Graphile Worker, a queue stored in PostgreSQL itself. At today's load, that's one less service to pay for, monitor and keep running.",
        },
      ],
    },
    {
      title: {
        pt: "Stripe Checkout e webhooks idempotentes",
        en: "Stripe Checkout and idempotent webhooks",
      },
      paragraphs: [
        {
          pt: "O pagamento acontece na página da Stripe, então o dado do cartão nunca passa pelo nosso servidor. O acesso só é liberado quando chega o webhook, e cada transação é registrada: se o mesmo evento chegar duas vezes, ele é ignorado.",
          en: "Payment happens on Stripe's page, so card data never touches our server. Access is only granted when the webhook arrives, and every transaction is recorded: if the same event arrives twice, it's ignored.",
        },
      ],
    },
    {
      title: { pt: "Agenda em UTC", en: "Schedules in UTC" },
      paragraphs: [
        {
          pt: "Todos os horários são salvos em UTC e convertidos pelo fuso de atendimento do psicólogo. A reserva é uma tentativa: o horário só segue para o pagamento se ainda estiver livre.",
          en: "Every time slot is stored in UTC and converted to the psychologist's working time zone. Booking is an attempt: the slot only moves on to payment if it's still free.",
        },
        {
          pt: "No Google, dois escopos: todo mundo usa o login, mas só o psicólogo concede acesso à agenda.",
          en: "With Google, two scopes: everyone uses sign-in, but only psychologists grant calendar access.",
        },
      ],
    },
    {
      title: { pt: "IA assíncrona e anonimizada", en: "Async, anonymized AI" },
      paragraphs: [
        {
          pt: "Quando a sessão termina, um job assume: transcreve com a Deepgram, remove da transcrição os dados pessoais que o banco já conhece e manda o texto para o Claude estruturar o prontuário. O psicólogo recebe um rascunho em vez de uma página em branco.",
          en: "When a session ends, a job takes over: it transcribes with Deepgram, strips out the personal data the database already knows about and sends the text to Claude to structure the notes. The psychologist gets a draft instead of a blank page.",
        },
      ],
    },
    {
      title: { pt: "Pequeno, mas pronto para crescer", en: "Small, but ready to grow" },
      paragraphs: [
        {
          pt: "Uma máquina para cada serviço, no plano mais simples, porque a demanda não pedia mais. O banco só aceita conexões do backend, tem backup diário, e o staging replica o ecossistema inteiro a partir da branch de desenvolvimento.",
          en: "One machine per service, on the simplest plan, because demand didn't call for more. The database only accepts connections from the backend and is backed up daily, and staging replicates the whole ecosystem from the development branch.",
        },
      ],
    },
  ],
  diagram: {
    left: {
      title: { pt: "Navegador", en: "Browser" },
      sub: same("React + Vite · Vercel"),
      items: [
        { label: { pt: "Painel do cliente", en: "Client dashboard" } },
        { label: { pt: "Painel do psicólogo", en: "Psychologist dashboard" } },
        { label: { pt: "Empresa e funcionários · NR-1", en: "Company & employees · NR-1" } },
        { label: { pt: "Admin e eventos", en: "Admin & events" } },
      ],
    },
    middle: {
      title: same("API"),
      sub: same("NestJS · Digital Ocean"),
      items: [
        { label: { pt: "Permissões por perfil", en: "Per-profile permissions" }, accent: true },
        { label: { pt: "Pagamentos e webhooks", en: "Payments & webhooks" } },
        { label: { pt: "Agenda", en: "Scheduling" } },
        { label: { pt: "Jobs em segundo plano", en: "Background jobs" } },
      ],
    },
    right: [
      {
        title: same("PostgreSQL"),
        sub: { pt: "dados, eventos e fila", en: "data, events, queue" },
      },
      {
        title: same("Stripe"),
        sub: { pt: "checkout e webhooks", en: "checkout & webhooks" },
        both: true,
      },
      {
        title: same("Google"),
        sub: { pt: "login e agenda", en: "sign-in & calendar" },
        both: true,
      },
      { title: { pt: "IA", en: "AI" }, sub: same("Deepgram · Claude"), both: true },
    ],
    links: [{ row: 0, label: { pt: "HTTPS · sessão", en: "HTTPS · session" }, dir: "both" }],
  },
  architecture: {
    pt: "Os quatro painéis falam com uma única API NestJS, que decide pelo perfil da sessão o que cada um pode ver. A API guarda dados, eventos e a fila de jobs no PostgreSQL e conversa com a Stripe, o Google e os serviços de IA.",
    en: "The four dashboards talk to a single NestJS API, which decides from the session's profile what each one may see. The API keeps data, events and the job queue in PostgreSQL and talks to Stripe, Google and the AI services.",
  },
  result: [
    {
      pt: "A plataforma está em produção, com cerca de 100 contas ativas entre os três públicos. O resumo de sessão com IA economiza de 3 a 8 horas por semana para cada psicólogo que usa, tempo que antes ia para escrever prontuários de memória.",
      en: "The platform is in production, with about 100 active accounts across the three audiences. The AI session summary saves each psychologist who uses it 3 to 8 hours a week, time that used to go into writing notes from memory.",
    },
  ],
  afterword: {
    title: { pt: "O bug do boleto", en: "The boleto bug" },
    paragraphs: [
      {
        pt: "Na feature de assinaturas, passamos dias testando no staging: crédito, débito, cartão recusado, expirado, sem saldo, timeout. Subimos, funcionou. Aí um cliente clicou em “pagar com boleto”: alguém tinha ativado essa opção direto no painel da Stripe, e a versão que testamos não tinha.",
        en: "For the subscriptions feature we spent days testing on staging: credit, debit, declined, expired, insufficient funds, timeouts. We shipped, it worked. Then a customer clicked “pay with boleto” (a Brazilian bank slip): someone had turned that option on directly in the Stripe dashboard, and the version we tested didn't have it.",
      },
      {
        pt: "Revertemos a configuração e ajudamos a pessoa a concluir o pagamento. A lição que ficou: sempre vai existir um cenário que você não testou. O objetivo não é zero bugs, é zero impacto.",
        en: "We reverted the setting and helped the customer finish paying. The lesson: there will always be a scenario you didn't test. The goal isn't zero bugs, it's zero impact.",
      },
    ],
  },
};
