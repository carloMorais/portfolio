/**
 * The Renova demo's FIPE side: the same four tools the original bot hands to
 * GPT-4o (getMarcas → getModelos → getAnos → getValor), calling the same
 * public API (parallelum.com.br, open CORS, no key). The conversation around
 * them is scripted; these calls are real.
 */

export const FIPE_BASE = "https://parallelum.com.br/fipe/api/v1";

export type VehicleType = "carros" | "motos" | "caminhoes";
export const VEHICLE_TYPES: VehicleType[] = ["carros", "motos", "caminhoes"];

export type Option = { code: string; name: string };

export type Price = {
  value: string;
  brand: string;
  model: string;
  year: number;
  fuel: string;
  fipeCode: string;
  month: string;
};

export type ToolName = "getMarcas" | "getModelos" | "getAnos" | "getValor";

/** One tool call as the model would make it: name, arguments, path on the API. */
export type ToolCall = { name: ToolName; args: Record<string, string>; path: string };

export function marcasCall(vehicleType: VehicleType): ToolCall {
  return { name: "getMarcas", args: { vehicleType }, path: `/${vehicleType}/marcas` };
}

export function modelosCall(vehicleType: VehicleType, marcaId: string): ToolCall {
  return {
    name: "getModelos",
    args: { vehicleType, marcaId },
    path: `/${vehicleType}/marcas/${marcaId}/modelos`,
  };
}

export function anosCall(vehicleType: VehicleType, marcaId: string, modeloId: string): ToolCall {
  return {
    name: "getAnos",
    args: { vehicleType, marcaId, modeloId },
    path: `/${vehicleType}/marcas/${marcaId}/modelos/${modeloId}/anos`,
  };
}

export function valorCall(
  vehicleType: VehicleType,
  marcaId: string,
  modeloId: string,
  ano: string,
): ToolCall {
  return {
    name: "getValor",
    args: { vehicleType, marcaId, modeloId, ano },
    path: `/${vehicleType}/marcas/${marcaId}/modelos/${modeloId}/anos/${ano}`,
  };
}

/** The raw answer, as text: what goes back to the model, and how much of it. */
export type RawResult = { text: string; ms: number };

export type Fetcher = (
  url: string,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/**
 * Calls the FIPE API, caching by path for the page's lifetime: the table
 * changes once a month, and the public API allows 500 calls a day per visitor.
 * A failed call is not cached, so "try again" really tries again.
 */
export function createFipeClient(fetcher: Fetcher, now: () => number = () => performance.now()) {
  const cache = new Map<string, Promise<string>>();

  return async function run(call: ToolCall): Promise<RawResult> {
    const start = now();
    let pending = cache.get(call.path);
    if (!pending) {
      pending = fetcher(FIPE_BASE + call.path).then(async (res) => {
        const text = await res.text();
        if (!res.ok) throw new FipeError(res.status, text);
        return text;
      });
      cache.set(call.path, pending);
      pending.catch(() => cache.delete(call.path));
    }
    const text = await pending;
    return { text, ms: Math.round(now() - start) };
  };
}

export class FipeError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`FIPE ${status}: ${body.slice(0, 120)}`);
  }
}

/**
 * The tool's error string, in the original's words (`handleAPIError` in
 * Renova's fipeTools.ts): the model reads it and can recover, instead of the
 * request blowing up.
 */
export function toolError(name: ToolName, error: unknown): string {
  const context = {
    getMarcas: "vehicle brands",
    getModelos: "models",
    getAnos: "production years",
    getValor: "price",
  }[name];
  if (error instanceof FipeError && error.status === 404) {
    return `Error: ${context} not found. Please check the provided identifiers.`;
  }
  if (error instanceof Error) return `Error: Failed to fetch ${context} - ${error.message}`;
  return `Error: An unexpected error occurred during ${context} fetch.`;
}

type RawOption = { codigo: string | number; nome: string };

const toOption = (o: RawOption): Option => ({ code: String(o.codigo), name: o.nome.trim() });

export function parseMarcas(text: string): Option[] {
  return (JSON.parse(text) as RawOption[]).map(toOption);
}

export function parseModelos(text: string): Option[] {
  return (JSON.parse(text) as { modelos: RawOption[] }).modelos.map(toOption);
}

/**
 * Years. The table lists brand-new vehicles under the year 32000; the
 * original prompt told the model to hide those, and so does the demo.
 */
export function parseAnos(text: string): Option[] {
  return (JSON.parse(text) as RawOption[]).map(toOption).filter((o) => !o.code.startsWith("32000"));
}

export function parseValor(text: string): Price {
  const raw = JSON.parse(text) as Record<string, string | number>;
  return {
    value: String(raw.Valor),
    brand: String(raw.Marca),
    model: String(raw.Modelo),
    year: Number(raw.AnoModelo),
    fuel: String(raw.Combustivel),
    fipeCode: String(raw.CodigoFipe),
    month: String(raw.MesReferencia).trim(),
  };
}

/** Case- and accent-insensitive search over option names (and codes). */
export function filterOptions(options: Option[], query: string): Option[] {
  const q = fold(query.trim());
  if (!q) return options;
  return options.filter((o) => fold(o.name).includes(q) || o.code === q);
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** `{ vehicleType: "carros", marcaId: "21" }`, the way the call reads in a log. */
export function formatArgs(args: Record<string, string>): string {
  const body = Object.entries(args)
    .map(([k, v]) => `${k}: "${v}"`)
    .join(", ");
  return `{ ${body} }`;
}

/** The first lines of the answer, pretty-printed, for the "see the answer" peek. */
export function preview(text: string, lines = 8): { head: string; more: number } {
  let pretty: string;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    pretty = text;
  }
  const all = pretty.split("\n");
  return { head: all.slice(0, lines).join("\n"), more: Math.max(0, all.length - lines) };
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * The table's reference month ("outubro de 2026") in the visitor's language.
 * Anything unexpected is shown as the API sent it.
 */
export function monthLabel(month: string, locale: string): string {
  const match = /^(\p{L}+) de (\d{4})$/u.exec(month.trim().toLowerCase());
  const index = match ? MONTHS.indexOf(match[1]) : -1;
  if (!match || index < 0) return month;
  if (locale === "pt") return month.trim();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(Number(match[2]), index, 15));
}
