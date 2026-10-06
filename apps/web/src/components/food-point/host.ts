import { createServer, emptyDb, type Db, type Mail, type Reply } from "./server";

/** The demo account, shown above the app. */
export const DEMO_USER = {
  fullname: "Visitante",
  email: "visitante@foodpoint.com",
  password: "foodpoint2024",
};

/** Bump when the shape of `Db` or the seed changes: old copies are dropped. */
const STORAGE_KEY = "foodpoint-demo:db:v1";

/** Uploaded pictures above this size are refused, to fit in localStorage. */
export const MAX_UPLOAD_BYTES = 1_500_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** dd/mm/yyyy, as the 2024 database stores dates. */
export const ddmmyyyy = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/**
 * A fresh database: the demo account with one event two weeks ahead, a menu
 * of three dishes (so the shopping list has something to add up) and three
 * guests.
 */
export function seed(today: Date, uuid: () => string): Db {
  const db = emptyDb();
  const userId = uuid();
  const eventId = uuid();
  const date = new Date(today);
  date.setDate(date.getDate() + 14);

  db.users.push({ id: userId, ...DEMO_USER });
  db.events.push({
    event_id: eventId,
    user_id: userId,
    event_name: "Noite italiana",
    theme: "Massas",
    event_description: "Jantar para a família e os amigos.",
    event_date: ddmmyyyy(date),
    event_time: "19:30",
    event_location: "-23.1791,-45.8872",
  });

  const menu: [string, string, [string, string, number][]][] = [
    [
      "Entrada",
      "Bruschetta",
      [
        ["Tomate", "Unidades (u)", 4],
        ["Pão italiano", "Unidades (u)", 1],
        ["Azeite", "Mililitros (ml)", 50],
      ],
    ],
    [
      "Principal",
      "Espaguete ao sugo",
      [
        ["Espaguete", "Gramas (g)", 1000],
        ["Tomate", "Unidades (u)", 8],
        ["Azeite", "Mililitros (ml)", 30],
      ],
    ],
    [
      "Sobremesa",
      "Pudim",
      [
        ["Leite condensado", "Unidades (u)", 1],
        ["Leite", "Mililitros (ml)", 400],
        ["Ovo", "Unidades (u)", 3],
      ],
    ],
  ];
  for (const [type, dish_name, ingredients] of menu) {
    const dishId = uuid();
    db.dishes.push({ id: dishId, event_id: eventId, dish_name, type });
    for (const [name, unity_measure, quantity] of ingredients) {
      db.ingredients.push({
        id: uuid(),
        event_id: eventId,
        dish_id: dishId,
        name,
        unity_measure,
        quantity,
        purchased: false,
      });
    }
  }
  for (const [name, confirmed] of [
    ["Ana", true],
    ["Bruno", true],
    ["Carla", false],
  ] as const) {
    db.guests.push({ id: uuid(), event_id: eventId, name, confirmed });
  }
  return db;
}

/** One request the 2024 frontend made, for the log beside the app. */
export type LogEntry = {
  id: number;
  method: string;
  path: string;
  status: number;
  ms: number;
  request?: string;
  response: string;
};

/** What the iframe's `fetch` turns into a `Response`. */
export type WireReply = { status: number; text: string; type: string };

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

type HostOptions = {
  storage: Storage | null;
  uuid?: () => string;
  today?: () => Date;
  /** Simulated network time, so the 2024 loading states still show. */
  latency?: number;
  onLog?: (entry: LogEntry) => void;
  onMail?: (mail: Mail) => void;
  onNavigate?: (path: string) => void;
};

const randomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
};

/** Reads an uploaded file as a data URL (the picture lives in the browser). */
function readFile(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type FormLike = { get(name: string): unknown };
const isForm = (body: unknown): body is FormLike =>
  typeof body === "object" && body !== null && typeof (body as FormLike).get === "function";
const isBlob = (value: unknown): value is Blob =>
  typeof value === "object" && value !== null && typeof (value as Blob).arrayBuffer === "function";

/**
 * The bridge the iframe talks to (`window.__foodPointDemo`): requests to
 * `/api` go to the simulated server, the database is saved in localStorage
 * after every request, and the parent page hears about each request, every
 * "e-mail" and every page change.
 */
export function createHost(opts: HostOptions) {
  const uuid = opts.uuid ?? (() => crypto.randomUUID());
  const today = opts.today ?? (() => new Date());
  const server = createServer({ uuid, today, code: randomCode, onMail: opts.onMail });
  let nextId = 1;

  function load(): Db {
    try {
      const saved = opts.storage?.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as Db;
    } catch {
      // Blocked or corrupt storage: start over.
    }
    return seed(today(), uuid);
  }

  let db = load();

  function save() {
    try {
      opts.storage?.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Full or blocked: the demo keeps working for this visit.
    }
  }

  async function parse(body: unknown): Promise<{ value: unknown; logged?: string }> {
    if (body === undefined || body === null) return { value: undefined };
    if (typeof body === "string") {
      try {
        return { value: JSON.parse(body), logged: body };
      } catch {
        return { value: undefined, logged: body };
      }
    }
    if (isForm(body)) {
      const file = body.get("image");
      if (!isBlob(file)) return { value: {}, logged: "FormData" };
      const logged = `FormData { image: ${file.type || "file"}, ${file.size} bytes }`;
      // Too big for localStorage: the route answers as if the file never came.
      if (file.size > MAX_UPLOAD_BYTES) return { value: {}, logged };
      return { value: { image: await readFile(file) }, logged };
    }
    return { value: undefined };
  }

  async function request(method: string, path: string, body?: unknown): Promise<WireReply> {
    const started = performance.now();
    const { value, logged } = await parse(body);
    const pathname = path.split("?")[0];
    const reply: Reply = server.handle(db, method.toUpperCase(), pathname, value);
    save();
    if (opts.latency) await new Promise((r) => setTimeout(r, opts.latency));

    const html = typeof reply.body === "string";
    const text = html ? (reply.body as string) : JSON.stringify(reply.body);
    opts.onLog?.({
      id: nextId++,
      method: method.toUpperCase(),
      path: `/api${path}`,
      status: reply.status,
      ms: Math.round(performance.now() - started),
      request: logged,
      response: text,
    });
    return { status: reply.status, text, type: html ? "text/html" : "application/json" };
  }

  return {
    request,
    /** The picture saved for `/assets/uploads/<hash>`, if any. */
    upload: (hash: string) => db.uploads.find((u) => u.hash_name === hash)?.image ?? null,
    navigate: (path: string) => opts.onNavigate?.(path),
    /** Back to the seed: the demo account and its sample event. */
    reset() {
      db = seed(today(), uuid);
      save();
    },
  };
}

export type DemoHost = ReturnType<typeof createHost>;
