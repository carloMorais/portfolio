import { same, type CaseStudy } from "./types";

/**
 * Derived from the public repository (github.com/carloMorais/renova) and its
 * git history, plus what Carlos confirmed on 05/10/2026: a solo project, from
 * the idea to the code, built for a hiring process Alpha EdTech referred him
 * to. The company stays unnamed here.
 */
export const renova: CaseStudy = {
  slug: "renova",
  lead: {
    pt: "Um chatbot que consulta a Tabela FIPE: o modelo conversa, e quatro ferramentas buscam marca, modelo, ano e preço na API pública, na ordem que ela exige.",
    en: "A chatbot that looks up Brazil's FIPE vehicle price table: the model does the talking, and four tools fetch brand, model, year and price from the public API, in the order it demands.",
  },
  summary: [
    {
      pt: "Projeto solo, feito em cerca de 10 dias como desafio de um processo seletivo.",
      en: "A solo project, built in about 10 days as a hiring challenge.",
    },
    {
      pt: "Um chatbot com GPT-4o e quatro ferramentas que consultam a API da FIPE na ordem certa, num laço de chamadas próprio.",
      en: "A GPT-4o chatbot with four tools that query the FIPE API in the right order, in a tool-calling loop of my own.",
    },
    {
      pt: "O processo seletivo terminou na minha contratação. A demonstração acima usa a FIPE de verdade.",
      en: "The hiring process ended with me hired. The demo above uses the real FIPE API.",
    },
  ],
  facts: [
    {
      label: { pt: "Quando", en: "When" },
      value: { pt: "fev — mar 2025 · 10 dias", en: "Feb — Mar 2025 · 10 days" },
    },
    {
      label: { pt: "Papel", en: "Role" },
      value: { pt: "Projeto solo · da ideia ao código", en: "Solo project · from idea to code" },
    },
    {
      label: { pt: "Origem", en: "Origin" },
      value: { pt: "Desafio de processo seletivo", en: "Hiring process challenge" },
    },
    {
      label: { pt: "Stack", en: "Stack" },
      value: same(
        "TypeScript, React, Vite, Tailwind, Node.js, Express, Prisma, PostgreSQL, LangChain, OpenAI (GPT-4o), Docker",
      ),
    },
  ],
  context: [
    {
      pt: "Em fevereiro de 2025, a Alpha EdTech me indicou para o processo seletivo de uma startup de IA conversacional. O Renova foi o projeto que eu fiz para esse processo: um chatbot que consulta preços na Tabela FIPE, a referência de preço de veículos no Brasil.",
      en: "In February 2025, Alpha EdTech referred me to the hiring process of a conversational AI startup. Renova was the project I built for it: a chatbot that looks up prices in the FIPE table, Brazil's reference for vehicle prices.",
    },
    {
      pt: "Fiz sozinho, em cerca de 10 dias: a ideia, o desenho da solução, o protótipo e o código, do banco de dados à interface.",
      en: "I built it alone, in about 10 days: the idea, the solution design, the prototype and the code, from the database to the interface.",
    },
  ],
  problem: [
    {
      pt: "A API da FIPE não responde a uma pergunta como “quanto vale um Palio 2012?”. Ela é uma sequência: tipo de veículo, marca, modelo, ano e preço, e cada passo pede o código exato que veio do passo anterior. Um modelo de linguagem conversa bem, mas inventa números e códigos com a mesma confiança.",
      en: "The FIPE API doesn't answer a question like “how much is a 2012 Palio?”. It is a sequence: vehicle type, brand, model, year and price, and each step needs the exact code returned by the step before. A language model is good at conversation, but it makes up numbers and codes just as confidently.",
    },
    {
      pt: "O bot precisava juntar as duas coisas: deixar a pessoa falar do jeito dela e, por baixo, seguir a ordem da API sem nunca chutar um código ou um preço.",
      en: "The bot had to bring both together: let people talk their own way and, underneath, follow the API's order without ever guessing a code or a price.",
    },
  ],
  myPart: {
    paragraphs: [
      {
        pt: "Projeto solo: todas as partes abaixo são minhas.",
        en: "A solo project: every part below is mine.",
      },
    ],
    bullets: [
      {
        pt: "Backend em Express e TypeScript: rotas de conversas e mensagens, validação de entrada e Prisma sobre PostgreSQL.",
        en: "Backend in Express and TypeScript: conversation and message routes, input validation and Prisma on PostgreSQL.",
      },
      {
        pt: "O bot: GPT-4o pelo LangChain, quatro ferramentas tipadas com Zod e o laço que executa as chamadas.",
        en: "The bot: GPT-4o through LangChain, four Zod-typed tools and the loop that runs the calls.",
      },
      {
        pt: "O system prompt e a descrição de cada ferramenta.",
        en: "The system prompt and each tool's description.",
      },
      {
        pt: "Frontend em React, Vite e Tailwind: lista de conversas, chat com Markdown, animação de espera e o tempo de cada resposta.",
        en: "Frontend in React, Vite and Tailwind: a conversation list, a chat with Markdown, a waiting animation and each reply's duration.",
      },
      {
        pt: "Docker Compose com o banco, a API e o frontend servido pelo Nginx.",
        en: "Docker Compose with the database, the API and the frontend served by Nginx.",
      },
    ],
  },
  decisions: [
    {
      title: { pt: "Ferramentas no lugar de chute", en: "Tools instead of guesses" },
      paragraphs: [
        {
          pt: "Cada passo da API virou uma ferramenta (getMarcas, getModelos, getAnos e getValor) com os argumentos validados por Zod. As descrições dizem a ordem e proíbem códigos inventados, e o prompt deixa claro que a Tabela FIPE é a única fonte de preço.",
          en: "Each API step became a tool (getMarcas, getModelos, getAnos and getValor) with Zod-validated arguments. The descriptions spell out the order and forbid made-up codes, and the prompt makes the FIPE table the only source of prices.",
        },
      ],
    },
    {
      title: { pt: "Um laço de ferramentas próprio", en: "A tool loop of my own" },
      paragraphs: [
        {
          pt: "Na primeira versão, o bot fazia uma chamada e respondia. Depois virou um laço: enquanto o modelo pedir ferramentas, o servidor executa e devolve o resultado, e ele pode encadear passos numa mesma resposta. Usei o bindTools do LangChain e escrevi o laço à mão, sem o AgentExecutor.",
          en: "In the first version, the bot made one call and answered. Then it became a loop: as long as the model asks for tools, the server runs them and hands back the result, so it can chain steps in a single reply. I used LangChain's bindTools and wrote the loop by hand, without the AgentExecutor.",
        },
      ],
    },
    {
      title: { pt: "O histórico inclui as ferramentas", en: "The history includes the tools" },
      paragraphs: [
        {
          pt: "O modelo não guarda nada de uma mensagem para a outra. Sem as respostas da FIPE no histórico, o bot perdia os códigos que tinha acabado de mostrar. A solução foi salvar no banco também as chamadas de ferramenta e as respostas delas, como um tipo de mensagem próprio, e remontar a conversa inteira a cada mensagem. O prompt ainda pede para mostrar sempre “[código] Nome”, para a pessoa poder responder com o código exato.",
          en: "The model keeps nothing from one message to the next. Without FIPE's answers in the history, the bot lost the codes it had just shown. The fix was to store the tool calls and their answers in the database too, as their own message type, and rebuild the whole conversation on every message. The prompt also asks to always show “[code] Name”, so people can answer with the exact code.",
        },
      ],
    },
    {
      title: { pt: "Listas grandes, inteiras", en: "Big lists, whole" },
      paragraphs: [
        {
          pt: "Algumas respostas são enormes: só a Fiat tem 586 modelos, quase 39 mil caracteres. Cheguei a cortar cada lista em 100 itens, mas assim o modelo que a pessoa procurava podia ficar de fora. O corte saiu, e as listas vão inteiras.",
          en: "Some answers are huge: Fiat alone has 586 models, almost 39 thousand characters. I tried cutting every list at 100 items, but then the model a person was looking for could be left out. The cut came out, and lists go in whole.",
        },
      ],
    },
    {
      title: { pt: "Prompt de objetivos, não de passos", en: "A prompt of goals, not steps" },
      paragraphs: [
        {
          pt: "O primeiro system prompt ditava cada ação e quando chamar cada ferramenta: o bot ficou previsível, mas engessado. Reescrevi focando no objetivo e nas regras que não podem quebrar, como a ordem da API, e deixei o modelo escolher o caminho. A conversa ficou mais natural sem perder a consulta.",
          en: "The first system prompt dictated every action and when to call each tool: the bot was predictable, but stiff. I rewrote it around the goal and the rules that can't break, like the API's order, and let the model pick the path. The conversation got more natural without breaking the lookup.",
        },
      ],
    },
    {
      title: { pt: "Erro vira resposta", en: "Errors become answers" },
      paragraphs: [
        {
          pt: "Se a API falha ou um código não existe, a ferramenta não derruba a requisição: devolve ao modelo um texto de erro (“not found, check the identifiers”), e ele pode pedir à pessoa outro dado.",
          en: "If the API fails or a code doesn't exist, the tool doesn't crash the request: it hands the model an error text (“not found, check the identifiers”), and the model can ask the person for something else.",
        },
      ],
    },
  ],
  diagram: {
    left: {
      title: { pt: "Navegador", en: "Browser" },
      sub: same("React + Vite"),
      items: [
        { label: { pt: "Lista de conversas", en: "Conversation list" } },
        { label: same("Chat"), accent: true },
        { label: { pt: "Resposta em Markdown", en: "Markdown reply" } },
      ],
    },
    middle: {
      title: { pt: "Servidor", en: "Server" },
      sub: same("Node.js + Express"),
      items: [
        { label: { pt: "API REST · conversas", en: "REST API · conversations" } },
        { label: { pt: "Bot · laço de ferramentas", en: "Bot · tool loop" }, accent: true },
        { label: { pt: "4 ferramentas FIPE", en: "4 FIPE tools" } },
      ],
    },
    right: [
      {
        title: same("PostgreSQL"),
        sub: { pt: "todo o histórico", en: "the whole history" },
      },
      { title: same("OpenAI"), sub: same("GPT-4o") },
      { title: { pt: "API FIPE", en: "FIPE API" }, sub: { pt: "pública", en: "public" } },
    ],
    links: [
      { row: 0, label: same("HTTP"), dir: "both" },
      { row: 1, label: { pt: "mensagem", en: "message" }, dir: "right", accent: true },
      { row: 2, label: { pt: "resposta", en: "reply" }, dir: "left" },
    ],
  },
  architecture: {
    pt: "O navegador lista as conversas e envia cada mensagem pela API REST. O Express remonta o histórico a partir do PostgreSQL, chama o GPT-4o com as quatro ferramentas e executa na API pública da FIPE as que ele pedir, até o modelo responder em texto. Tudo, inclusive as chamadas de ferramenta, volta para o banco.",
    en: "The browser lists conversations and sends each message over the REST API. Express rebuilds the history from PostgreSQL, calls GPT-4o with the four tools and runs the ones it asks for against FIPE's public API, until the model answers in text. Everything, tool calls included, goes back to the database.",
  },
  result: [
    {
      pt: "Entreguei em cerca de 10 dias: o chatbot funcionando de ponta a ponta, com as conversas salvas, o tempo de cada resposta e tudo subindo com Docker Compose.",
      en: "I delivered it in about 10 days: the chatbot working end to end, with saved conversations, each reply's duration and everything starting with Docker Compose.",
    },
    {
      pt: "O processo seletivo terminou na minha contratação: trabalhei nessa startup de abril de 2025 a janeiro de 2026.",
      en: "The hiring process ended with me being hired: I worked at that startup from April 2025 to January 2026.",
    },
    {
      pt: "O código está público no GitHub. A demonstração no topo desta página reproduz a conversa com as mesmas quatro ferramentas, chamando a API da FIPE de verdade.",
      en: "The code is public on GitHub. The demo at the top of this page replays the conversation with the same four tools, calling the real FIPE API.",
    },
  ],
};
