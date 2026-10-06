import { same, type CaseStudy } from "./types";

/**
 * Derived from the repository (github.com/carloMorais/food-point, a copy of
 * the team's original) and its git history ("delfo" is Carlos), plus the
 * interview of 05/10/2026: a team of four with no lead, where Carlos was a
 * developer. Teammates are credited without names, as he asked.
 */
export const foodPoint: CaseStudy = {
  slug: "food-point",
  lead: {
    pt: "Uma plataforma para planejar eventos gastronômicos: o evento, o local no mapa, o cardápio com os ingredientes, os convidados e a lista de compras. Uma SPA em JavaScript puro, sem framework, feita em grupo.",
    en: "A platform to plan food-centered events: the event, the place on a map, the menu with its ingredients, the guests and the shopping list. A single-page app in plain JavaScript, no framework, built by a team.",
  },
  facts: [
    {
      label: { pt: "Quando", en: "When" },
      value: { pt: "abr — mai 2024 · ~4 semanas", en: "Apr — May 2024 · ~4 weeks" },
    },
    {
      label: { pt: "Papel", en: "Role" },
      value: {
        pt: "Desenvolvedor · time de 4, sem líder",
        en: "Developer · team of 4, no lead",
      },
    },
    {
      label: { pt: "Origem", en: "Origin" },
      value: { pt: "Projeto de grupo na Alpha EdTech", en: "Team project at Alpha EdTech" },
    },
    {
      label: { pt: "Stack", en: "Stack" },
      value: same("JavaScript, HTML, CSS, Node.js, Express, PostgreSQL, Leaflet, JWT, Nginx"),
    },
  ],
  context: [
    {
      pt: "Em abril de 2024, uns seis meses depois de eu entrar na Alpha EdTech, o desafio do ciclo era uma aplicação de eventos, com listas e cadastros. Meu grupo escolheu eventos gastronômicos: a pessoa monta o evento, o cardápio e a lista de convidados, e a plataforma junta os ingredientes de todos os pratos numa lista de compras.",
      en: "In April 2024, about six months after I joined Alpha EdTech, the cycle's challenge was an events app, with lists and records to create and edit. My team chose food-centered events: you put together the event, the menu and the guest list, and the platform gathers every dish's ingredients into one shopping list.",
    },
    {
      pt: "As regras eram duas: nenhum framework no frontend e só o Express no backend. Era o começo da formação, e o que se avaliava era o conhecimento técnico, não o produto.",
      en: "There were two rules: no framework on the frontend and only Express on the backend. It was early in the program, and what was graded was technical knowledge, not the product.",
    },
    {
      pt: "Éramos quatro, sem líder: as decisões saíam por consenso. Eu fui desenvolvedor.",
      en: "We were four, with no lead: decisions were made by consensus. I was a developer.",
    },
  ],
  problem: [
    {
      pt: "Sem React nem Vue, tudo o que um framework entrega pronto precisava ser escrito à mão: trocar de página sem recarregar, montar cada tela pelo DOM, levar dados de uma tela para a outra e falar com a API.",
      en: "Without React or Vue, everything a framework hands you had to be written by hand: changing pages without a reload, building each screen through the DOM, carrying data from one screen to the next and talking to the API.",
    },
    {
      pt: "E criar um evento é um fluxo de vários passos (informações, local, cardápio e convidados), cada um com a sua tela, que precisava conversar com um backend sendo escrito ao mesmo tempo, por outras pessoas.",
      en: "And creating an event is a flow of several steps (details, place, menu and guests), each with its own screen, which had to talk to a backend being written at the same time, by other people.",
    },
  ],
  myPart: {
    paragraphs: [
      {
        pt: "Fiz a maior parte do frontend e algumas partes do backend. Outras telas, como o login, o perfil, a recuperação de senha e a lista de compras, são de colegas do time.",
        en: "I built most of the frontend and some parts of the backend. Other screens, such as login, the profile, password recovery and the shopping list, are my teammates' work.",
      },
    ],
    bullets: [
      {
        pt: "O roteador da SPA, em JavaScript puro, com rotas que exigem login.",
        en: "The single-page app's router, in plain JavaScript, with routes that require login.",
      },
      {
        pt: "A camada de API do frontend e componentes usados em várias telas.",
        en: "The frontend's API layer and components shared across screens.",
      },
      {
        pt: "A home e todo o fluxo de criar um evento: informações, local (CEP, mapa com Leaflet e endereço legível pelo Nominatim) e cardápio. Também a tela de convidados.",
        en: "The home page and the whole create-event flow: details, place (postal code, a Leaflet map and a readable address from Nominatim) and menu. The guests screen too.",
      },
      {
        pt: "No backend: a inicialização do Express, as rotas que servem as páginas, a conexão com o PostgreSQL e o login.",
        en: "On the backend: the Express setup, the routes that serve the pages, the PostgreSQL connection and login.",
      },
      {
        pt: "O Nginx do servidor: proxy reverso com HTTPS na frente do Node.",
        en: "The server's Nginx: a reverse proxy with HTTPS in front of Node.",
      },
      {
        pt: "Cerca de 60% do design no Figma. O protótipo se perdeu: a conta que o criou não existe mais.",
        en: "About 60% of the design in Figma. The prototype is lost: the account that created it no longer exists.",
      },
      {
        pt: "Na reta final, a maior parte das correções de integração entre frontend e backend.",
        en: "In the final stretch, most of the integration fixes between frontend and backend.",
      },
    ],
  },
  decisions: [
    {
      title: { pt: "Um roteador feito à mão", en: "A hand-written router" },
      paragraphs: [
        {
          pt: "As rotas são um objeto: para cada caminho, a função que monta a tela, o título, a descrição e se ela exige login. Para trocar de página, qualquer tela dispara um evento próprio (onstatechange); o roteador faz o pushState e redesenha a raiz. O botão voltar passa pelo popstate. Antes de montar uma tela protegida, o roteador pergunta à API quem está logado e, se ninguém estiver, manda para o login.",
          en: "Routes are an object: for each path, the function that builds the screen, the title, the description and whether it needs login. To change pages, any screen fires a custom event (onstatechange); the router calls pushState and redraws the root. The back button goes through popstate. Before building a protected screen, the router asks the API who is logged in and, if nobody is, sends you to login.",
        },
      ],
    },
    {
      title: { pt: "Telas como funções", en: "Screens as functions" },
      paragraphs: [
        {
          pt: "Cada tela é uma função que devolve um elemento do DOM, montado com createElement, sem template e sem virtual DOM. O que uma tela precisa passar para a próxima, como o evento recém-criado, vai junto no evento de navegação, e o roteador entrega para a função da tela seguinte.",
          en: "Each screen is a function that returns a DOM element, built with createElement, with no templates and no virtual DOM. What one screen needs to pass to the next, like the event just created, travels with the navigation event, and the router hands it to the next screen's function.",
        },
      ],
    },
    {
      title: { pt: "O local, do CEP ao endereço", en: "The place, from postal code to address" },
      paragraphs: [
        {
          pt: "O local pode vir da localização do navegador, de um CEP ou de um clique no mapa do Leaflet, e é salvo como coordenadas. Mostrar só “-23.17,-45.88” não dizia nada a ninguém, então as coordenadas passam pelo Nominatim, do OpenStreetMap, que devolve o endereço legível. Tudo isso é chamado direto do navegador, sem passar pelo nosso servidor.",
          en: "The place can come from the browser's location, a postal code or a click on the Leaflet map, and it is saved as coordinates. Showing just “-23.17,-45.88” meant nothing to anyone, so the coordinates go through OpenStreetMap's Nominatim, which returns a readable address. All of it is called straight from the browser, without going through our server.",
        },
      ],
    },
    {
      title: { pt: "Nginx na frente do Node", en: "Nginx in front of Node" },
      paragraphs: [
        {
          pt: "No servidor da Alpha EdTech, o Nginx recebia as requisições em HTTPS e repassava ao Node, e o que chegava em HTTP era redirecionado para HTTPS. O cookie do login é marcado como secure, e o navegador só o envia por HTTPS.",
          en: "On Alpha EdTech's server, Nginx took requests over HTTPS and passed them to Node, and anything arriving over HTTP was redirected to HTTPS. The login cookie is marked secure, so the browser only sends it over HTTPS.",
        },
      ],
    },
    {
      title: { pt: "A integração na reta final", en: "Integration in the final stretch" },
      paragraphs: [
        {
          pt: "Com as telas e a API prontas em paralelo, a última semana foi de juntar as partes. Corrigi eventos que disparavam duas vezes nos componentes do cardápio, coloquei debounce, telas de carregamento enquanto a API responde, o logout e a página 404, e uma correção de segurança no envio de imagens.",
          en: "With screens and API built in parallel, the last week was about putting them together. I fixed events firing twice in the menu components and added debounce, loading screens while the API answers, logout and the 404 page, plus a security fix in image uploads.",
        },
      ],
    },
  ],
  diagram: {
    left: {
      title: { pt: "Navegador", en: "Browser" },
      sub: { pt: "JavaScript puro", en: "Plain JavaScript" },
      items: [
        { label: { pt: "Roteador da SPA", en: "SPA router" }, accent: true },
        { label: { pt: "Telas montadas no DOM", en: "Screens built in the DOM" } },
        { label: { pt: "Mapa · Leaflet", en: "Map · Leaflet" } },
      ],
    },
    middle: {
      title: { pt: "Servidor", en: "Server" },
      sub: same("Nginx + Node.js + Express"),
      items: [
        { label: { pt: "Páginas · index.html", en: "Pages · index.html" } },
        { label: { pt: "API REST · login por JWT", en: "REST API · JWT login" }, accent: true },
        { label: { pt: "Validação · Joi", en: "Validation · Joi" } },
      ],
    },
    right: [
      {
        title: same("PostgreSQL"),
        sub: { pt: "eventos, cardápios, convidados", en: "events, menus, guests" },
      },
      {
        title: { pt: "Disco", en: "Disk" },
        sub: { pt: "fotos de perfil", en: "profile pictures" },
      },
    ],
    links: [
      { row: 0, label: same("HTML"), dir: "left" },
      { row: 1, label: same("JSON"), dir: "both", accent: true },
    ],
  },
  architecture: {
    pt: "O Nginx recebe tudo em HTTPS e repassa ao Express, que serve o mesmo index.html para qualquer página e a API REST em /api, com o login num JWT guardado em cookie HttpOnly e cada requisição validada com Joi. No navegador, o roteador escolhe a tela pelo caminho, e cada tela busca seus dados na API. O CEP e o endereço do mapa vêm de APIs públicas, chamadas direto do navegador.",
    en: "Nginx takes everything over HTTPS and passes it to Express, which serves the same index.html for every page and the REST API under /api, with login as a JWT in an HttpOnly cookie and each request validated with Joi. In the browser, the router picks the screen from the path, and each screen fetches its data from the API. The postal code and the map's address come from public APIs, called straight from the browser.",
  },
  result: [
    {
      pt: "Apresentamos o Food Point num demo day, para uma banca de alunos de outros grupos e de empresas parceiras da Alpha EdTech. Ele rodou no servidor da Alpha, onde algumas pessoas criaram contas e eventos. Esse servidor não existe mais, os dados se perderam, e não houve retorno de uso além da apresentação.",
      en: "We presented Food Point at a demo day, to a panel of students from other teams and partner companies of Alpha EdTech. It ran on Alpha's server, where a few people created accounts and events. That server is gone, the data was lost, and there was no usage feedback beyond the presentation.",
    },
    {
      pt: "Em janeiro de 2025, coloquei o projeto em Docker para rodar localmente e gravar uma demonstração (na época do desafio, ainda não tínhamos aprendido Docker).",
      en: "In January 2025, I put the project in Docker to run it locally and record a demo (at the time of the challenge, we hadn't learned Docker yet).",
    },
    {
      pt: "A demonstração no topo desta página roda o frontend de 2024 sem mudanças. Só o servidor é simulado, no seu navegador, com as mesmas rotas e respostas.",
      en: "The demo at the top of this page runs the 2024 frontend unchanged. Only the server is simulated, in your browser, with the same routes and answers.",
    },
  ],
};
