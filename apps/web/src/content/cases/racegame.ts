import { same, type CaseStudy } from "./types";

/**
 * Derived from the RaceGame resume and the public repository
 * (github.com/Projeto-Ciclo-2/RaceGame). Authorship per area comes from the
 * git history; Carlos confirmed the "delfo" account is his.
 */
export const racegame: CaseStudy = {
  slug: "racegame",
  lead: {
    pt: "Uma corrida top-down para até 10 jogadores na mesma pista, em que o servidor decide onde cada carro está e o navegador desenha a corrida sem esperar por ele.",
    en: "A top-down race for up to 10 players on the same track, where the server decides where every car is and the browser draws the race without waiting for it.",
  },
  summary: [
    {
      pt: "Líder de um time de 4 num projeto da Alpha EdTech, feito em 3 semanas.",
      en: "Lead of a team of 4 on an Alpha EdTech project, built in 3 weeks.",
    },
    {
      pt: "Escrevi o motor do jogo nos dois lados: servidor autoritativo a 30 ticks/s, predição e interpolação no cliente, por WebSocket.",
      en: "I wrote the game engine on both sides: an authoritative server at 30 ticks/s, client-side prediction and interpolation, over WebSocket.",
    },
    {
      pt: "Testado com a sala cheia, 10 jogadores. Em 2026 refiz o jogo com o Claude Code para rodar nesta página.",
      en: "Tested with a full room of 10 players. In 2026 I rebuilt it with Claude Code to run on this page.",
    },
  ],
  facts: [
    {
      label: { pt: "Quando", en: "When" },
      value: { pt: "nov 2024 · 3 semanas", en: "Nov 2024 · 3 weeks" },
    },
    {
      label: { pt: "Papel", en: "Role" },
      value: {
        pt: "Líder do projeto · motor do jogo",
        en: "Project lead · game engine",
      },
    },
    {
      label: { pt: "Time", en: "Team" },
      value: { pt: "4 pessoas", en: "4 people" },
    },
    {
      label: { pt: "Stack", en: "Stack" },
      value: {
        pt: "TypeScript, React, Canvas, Node.js, Express, ws, PostgreSQL, Redis, Docker",
        en: "TypeScript, React, Canvas, Node.js, Express, ws, PostgreSQL, Redis, Docker",
      },
    },
  ],
  context: [
    {
      pt: "Projeto do ciclo 2 da Alpha EdTech, uma code academy sem fins lucrativos que forma desenvolvedores em tempo integral, trabalhando em projetos reais. O time tinha três semanas para entregar um jogo multiplayer que rodasse no navegador, com login, salas e ranking.",
      en: "A cycle 2 project at Alpha EdTech, a non-profit code academy that trains developers full-time on real projects. The team had three weeks to ship a browser multiplayer game, with sign-in, rooms and a leaderboard.",
    },
    {
      pt: "Escolhemos uma corrida em visão de cima: pista com paredes, checkpoints, voltas, itens de nitro e até 10 carros disputando ao mesmo tempo.",
      en: "We picked a top-down race: a track with walls, checkpoints, laps, nitro pickups and up to 10 cars racing at once.",
    },
  ],
  problem: [
    {
      pt: "Numa corrida em tempo real, todos precisam ver a mesma corrida. Se cada navegador calcular a própria posição, dois jogadores discordam de quem está na frente, e qualquer um pode trapacear editando o JavaScript.",
      en: "In a real-time race everyone has to see the same race. If each browser computes its own position, two players disagree on who is ahead, and anyone can cheat by editing the JavaScript.",
    },
    {
      pt: "Se, ao contrário, o navegador só desenha o que o servidor manda, o próprio carro responde às setas com o atraso da rede, e os outros carros andam aos trancos entre uma atualização e outra.",
      en: "If instead the browser only draws what the server sends, your own car answers the arrow keys with network lag, and the other cars jump between one update and the next.",
    },
  ],
  myPart: {
    paragraphs: [
      {
        pt: "Como líder, coordenei o time, conduzi as decisões técnicas e a integração entre frontend e backend. No código, fiquei com o motor do jogo, dos dois lados. O restante do time cuidou do login, das salas e do lobby, e das telas.",
        en: "As lead, I coordinated the team and drove the technical decisions and the frontend/backend integration. In the code, I owned the game engine on both sides. The rest of the team handled sign-in, rooms and the lobby, and the screens.",
      },
    ],
    bullets: [
      {
        pt: "Game loop do servidor: física de velocidade e rotação, colisão com as paredes, checkpoints, voltas, itens e fim de corrida.",
        en: "Server game loop: speed and steering physics, wall collision, checkpoints, laps, pickups and the end of the race.",
      },
      {
        pt: "Game loop do cliente em Canvas, com predição do próprio carro e interpolação dos adversários.",
        en: "Client game loop on Canvas, with prediction for your own car and interpolation for opponents.",
      },
      {
        pt: "Boa parte do servidor WebSocket e do contrato de mensagens entre cliente e servidor.",
        en: "A large share of the WebSocket server and the client/server message contract.",
      },
      {
        pt: "Docker Compose de produção (frontend, backend, PostgreSQL e Redis).",
        en: "Production Docker Compose (frontend, backend, PostgreSQL and Redis).",
      },
    ],
  },
  decisions: [
    {
      title: {
        pt: "O servidor é a fonte da verdade",
        en: "The server is the source of truth",
      },
      paragraphs: [
        {
          pt: "O navegador não envia posição, só quais teclas estão apertadas. O servidor roda o loop a 30 ticks por segundo, aplica física e colisões e decide onde cada carro está. Assim não há como “teletransportar” o carro pelo console.",
          en: "The browser never sends a position, only which keys are pressed. The server runs the loop at 30 ticks per second, applies physics and collisions and decides where every car is. There is no way to “teleport” a car from the console.",
        },
      ],
    },
    {
      title: {
        pt: "Predição no cliente, com reconciliação",
        en: "Client-side prediction, with reconciliation",
      },
      paragraphs: [
        {
          pt: "Para o próprio carro não esperar a rede, o cliente aplica a mesma física localmente e guarda cada movimento numerado. Quando o estado do servidor chega, compara pelo número do movimento e só corrige a posição se as duas versões divergirem.",
          en: "So your own car doesn't wait on the network, the client runs the same physics locally and keeps every move numbered. When the server state arrives, it compares by move number and only corrects the position if the two versions disagree.",
        },
      ],
    },
    {
      title: {
        pt: "Interpolação para os outros carros",
        en: "Interpolation for the other cars",
      },
      paragraphs: [
        {
          pt: "Os adversários não são previstos: a cada quadro, o carro percorre metade da distância até a última posição recebida. Isso tira o tremido entre atualizações sem inventar movimento.",
          en: "Opponents are not predicted: on every frame, each car covers half the distance to its last received position. That removes the jitter between updates without inventing movement.",
        },
      ],
    },
    {
      title: {
        pt: "Só manda o que mudou",
        en: "Only send what changed",
      },
      paragraphs: [
        {
          pt: "Antes de transmitir, o servidor compara posição, velocidade e rotação com o tick anterior. Carro parado não gera mensagem, o que reduz o tráfego com 10 jogadores na sala.",
          en: "Before broadcasting, the server compares position, speed and rotation with the previous tick. A car that isn't moving produces no message, which cuts traffic with 10 players in a room.",
        },
      ],
    },
    {
      title: {
        pt: "WebSocket sem Socket.IO",
        en: "WebSocket without Socket.IO",
      },
      paragraphs: [
        {
          pt: "No servidor, a biblioteca ws; no navegador, a API nativa de WebSocket. As mensagens seguem um contrato tipado em TypeScript nos dois lados. Menos camadas entre o loop e o fio, e cada mensagem é nossa.",
          en: "On the server, the ws library; in the browser, the native WebSocket API. Messages follow a typed TypeScript contract on both sides. Fewer layers between the loop and the wire, and every message is ours.",
        },
      ],
    },
  ],
  diagram: {
    left: {
      title: { pt: "Navegador", en: "Browser" },
      sub: same("React + Canvas"),
      items: [
        { label: { pt: "Telas e lobby", en: "Screens and lobby" } },
        { label: { pt: "Game loop do cliente", en: "Client game loop" }, accent: true },
        { label: { pt: "Predição e interpolação", en: "Prediction & interpolation" } },
      ],
    },
    middle: {
      title: { pt: "Servidor", en: "Server" },
      sub: same("Node.js + Express"),
      items: [
        { label: { pt: "API REST · login", en: "REST API · sign-in" } },
        { label: same("WebSocket (ws)") },
        { label: same("Game loop · 30 ticks/s"), accent: true },
      ],
    },
    right: [
      { title: same("PostgreSQL"), sub: { pt: "usuários e carros", en: "users and cars" } },
      { title: same("Redis"), sub: { pt: "salas ativas", en: "live rooms" } },
    ],
    links: [
      { row: 0, label: same("HTTP"), dir: "both" },
      { row: 1, label: { pt: "teclas", en: "keys" }, dir: "right", accent: true },
      { row: 2, label: { pt: "estado", en: "state" }, dir: "left" },
    ],
  },
  architecture: {
    pt: "Na versão de 2024, o navegador envia teclas e desenha; o servidor Express autentica pela API REST, guarda usuários e carros no PostgreSQL e as salas ativas no Redis, e roda o game loop que transmite o estado pelo WebSocket.",
    en: "In the 2024 version, the browser sends keys and draws; the Express server authenticates over the REST API, keeps users and cars in PostgreSQL and live rooms in Redis, and runs the game loop that broadcasts state over WebSocket.",
  },
  result: [
    {
      pt: "O jogo foi entregue e testado com a sala cheia, 10 jogadores na mesma corrida, rodando num servidor da Alpha EdTech. O vídeo na seção abaixo é um recorte dessa partida.",
      en: "The game shipped and was tested with a full room, 10 players in the same race, running on an Alpha EdTech server. The video in the next section is a clip of that match.",
    },
  ],
  rewrite: {
    title: { pt: "A reescrita de 2026", en: "The 2026 rewrite" },
    paragraphs: [
      {
        pt: "A versão jogável no topo desta página é uma reimplementação de 2026, feita a partir do motor de 2024. O original dependia do login, do banco e do servidor da Alpha EdTech, e a arte dele não tem licença para ser republicada; para dar para jogar aqui, o jogo foi refeito com a mesma direção e o mesmo traçado.",
        en: "The playable version at the top of this page is a 2026 reimplementation, built from the 2024 engine. The original depended on sign-in, the database and Alpha EdTech's server, and its art isn't licensed for republishing; to make it playable here, the game was rebuilt with the same handling and the same track.",
      },
      {
        pt: "A reescrita foi feita com o Claude Code, a IA de programação da Anthropic: eu decidi o design, a física e o que entrava em cada rodada, joguei e revisei cada uma, e o código foi escrito em pareamento com a IA.",
        en: "The rewrite was done with Claude Code, Anthropic's AI coding tool: I decided the design, the physics and what went into each round, played and reviewed every one, and the code was written in pairing with the AI.",
      },
    ],
    bullets: [
      {
        pt: "O motor virou um pacote TypeScript sem dependências, com cada tick determinístico e testado, inclusive um teste de propriedade que garante que o carro nunca termina um movimento dentro de uma parede.",
        en: "The engine became a dependency-free TypeScript package, with every tick deterministic and tested, including a property test that guarantees a car never ends a move inside a wall.",
      },
      {
        pt: "A colisão foi refeita: o carro anda um eixo por vez e quica na parede em vez de grudar nela, o que acabou com o carro preso num canto da pista.",
        en: "Collision was redone: the car moves one axis at a time and bounces off walls instead of sticking to them, which ended cars getting stuck in a corner of the track.",
      },
      {
        pt: "Três modos: o treino, contra bots, e o contra o relógio, contra o fantasma da sua melhor corrida, rodam inteiros no navegador; o online roda no servidor (NestJS e ws, 30 ticks por segundo), e o navegador usa o mesmo motor para prever o próprio carro.",
        en: "Three modes: practice, against bots, and time trial, against the ghost of your best run, run entirely in the browser; online runs on the server (NestJS and ws, 30 ticks per second), and the browser uses the same engine to predict your own car.",
      },
      {
        pt: "Um formato compacto de mensagens (cerca de 11 KB/s por jogador numa sala de 10) e limites contra abuso protegem o servidor gratuito.",
        en: "A compact message format (about 11 KB/s per player in a room of 10) and abuse limits protect the free-tier server.",
      },
      {
        pt: "A pista é desenhada em código a partir das caixas de colisão do motor.",
        en: "The track is drawn in code from the engine's collision boxes.",
      },
    ],
  },
};
