"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  VEHICLE_TYPES,
  anosCall,
  createFipeClient,
  filterOptions,
  formatArgs,
  marcasCall,
  monthLabel,
  modelosCall,
  parseAnos,
  parseMarcas,
  parseModelos,
  parseValor,
  preview,
  toolError,
  valorCall,
  type Option,
  type Price,
  type ToolCall,
  type ToolName,
  type VehicleType,
} from "./fipe";

type Message = { id: number; from: "bot" | "user"; text: string; price?: Price };

type CallEntry = {
  id: number;
  call: ToolCall;
  status: "running" | "ok" | "error";
  ms?: number;
  /** What went back to the model: the raw answer, or the tool's error string. */
  output?: string;
  count?: number;
};

/** What the visitor can answer with, below the last message. */
type Step =
  | { kind: "type" }
  | { kind: "brand"; type: VehicleType; options: Option[] }
  | { kind: "model"; type: VehicleType; brand: Option; options: Option[] }
  | { kind: "year"; type: VehicleType; brand: Option; model: Option; options: Option[] }
  | { kind: "busy" }
  | { kind: "done" }
  | { kind: "error"; retry: () => void };

/** The bot's turn after a successful call: what it says and what comes next. */
type Turn = { text: string; price?: Price; count: number; next: Step };

/** The order the FIPE API demands, shown on the side before the first call. */
const TOOL_ORDER: ToolName[] = ["getMarcas", "getModelos", "getAnos", "getValor"];

/** Long lists show this many options until the visitor types a filter. */
const VISIBLE = 48;

/** The "thinking" dots stay at least this long, so a cached answer still reads as a turn. */
const MIN_THINK_MS = 650;

const run = createFipeClient((url) => fetch(url));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A replay of Renova, the FIPE chatbot: the lines are scripted and the
 * visitor answers with buttons, but every tool call is the real one, against
 * the real API, shown on the side as the model would see it.
 */
export function FipeChatDemo() {
  const t = useTranslations("Renova");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale === "pt" ? "pt-BR" : "en-US"), [locale]);

  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 0, from: "bot", text: t("greeting") },
  ]);
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [step, setStep] = useState<Step>({ kind: "type" });
  const [query, setQuery] = useState("");
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLOListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const id = () => nextId.current++;

  // Follow the conversation inside the window, never by scrolling the page.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const el of [logRef.current, panelRef.current]) {
      el?.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    }
  }, [messages.length, calls, step.kind]);

  // Keep typing where the filter is, on a desktop; on a phone, focusing it
  // would pop the keyboard over the options.
  useEffect(() => {
    if (step.kind !== "brand" && step.kind !== "model") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    filterRef.current?.focus({ preventScroll: true });
  }, [step]);

  /** One turn: the visitor's answer, the tool call, then the bot's reply. */
  async function ask(answer: string | null, call: ToolCall, reply: (text: string) => Turn) {
    if (answer) setMessages((m) => [...m, { id: id(), from: "user", text: answer }]);
    setQuery("");
    setStep({ kind: "busy" });
    const entry = id();
    setCalls((c) => [...c, { id: entry, call, status: "running" }]);
    const settle = (patch: Partial<CallEntry>) =>
      setCalls((c) => c.map((e) => (e.id === entry ? { ...e, ...patch } : e)));

    const thinking = wait(MIN_THINK_MS);
    try {
      const result = await run(call);
      const turn = reply(result.text);
      await thinking;
      settle({ status: "ok", ms: result.ms, output: result.text, count: turn.count });
      setMessages((m) => [...m, { id: id(), from: "bot", text: turn.text, price: turn.price }]);
      setStep(turn.next);
    } catch (error) {
      await thinking;
      settle({ status: "error", output: toolError(call.name, error) });
      setMessages((m) => [...m, { id: id(), from: "bot", text: t("error") }]);
      setStep({ kind: "error", retry: () => void ask(null, call, reply) });
    }
  }

  function pickType(type: VehicleType) {
    void ask(t(`type_${type}`), marcasCall(type), (text) => {
      const options = parseMarcas(text);
      return {
        text: t("brands", { count: options.length, type: t(`plural_${type}`) }),
        count: options.length,
        next: { kind: "brand", type, options },
      };
    });
  }

  function pickBrand(type: VehicleType, brand: Option) {
    void ask(brand.name, modelosCall(type, brand.code), (text) => {
      const options = parseModelos(text);
      return {
        text: t("models", { brand: brand.name, count: options.length }),
        count: options.length,
        next: { kind: "model", type, brand, options },
      };
    });
  }

  function pickModel(type: VehicleType, brand: Option, model: Option) {
    void ask(model.name, anosCall(type, brand.code, model.code), (text) => {
      const options = parseAnos(text);
      return options.length
        ? {
            text: t("years", { model: model.name, count: options.length }),
            count: options.length,
            next: { kind: "year", type, brand, model, options },
          }
        : { text: t("noYears"), count: 0, next: { kind: "done" } };
    });
  }

  function pickYear(type: VehicleType, brand: Option, model: Option, year: Option) {
    void ask(year.name, valorCall(type, brand.code, model.code, year.code), (text) => {
      const price = parseValor(text);
      return {
        text: t("price", { month: monthLabel(price.month, locale) }),
        price,
        count: 1,
        next: { kind: "done" },
      };
    });
  }

  function restart() {
    setMessages((m) => [...m, { id: id(), from: "bot", text: t("greeting") }]);
    setQuery("");
    setStep({ kind: "type" });
  }

  // What the model would get with the next message: every line so far, plus
  // every tool answer, since Renova rebuilds the whole history each time.
  const contextChars =
    messages.reduce((n, m) => n + m.text.length, 0) +
    calls.reduce((n, c) => n + (c.output?.length ?? 0), 0);

  const list = step.kind === "brand" || step.kind === "model" || step.kind === "year" ? step : null;
  const filtered = list ? filterOptions(list.options, query) : [];
  const shown = list?.kind === "year" ? filtered : filtered.slice(0, VISIBLE);

  return (
    <div className="container-page">
      <div className="overflow-hidden rounded-[var(--radius-photo)] border border-line bg-bg shadow-[0_1px_0_var(--line),0_24px_60px_-40px_color-mix(in_oklab,var(--ink)_45%,transparent)] lg:grid lg:h-[clamp(28rem,calc(100svh-21rem),38rem)] lg:grid-cols-[minmax(0,1fr)_23rem]">
        {/* Chat */}
        <section
          aria-label={t("chatLabel")}
          className="flex h-[min(30rem,78svh)] flex-col lg:h-full lg:min-h-0"
        >
          <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-ink font-display text-sm text-bg"
            >
              R
            </span>
            <div className="min-w-0">
              <p className="leading-tight font-medium">{t("window")}</p>
              <p className="text-xs text-muted">{t("windowSub")}</p>
            </div>
            <span className="ml-auto rounded-full border border-line px-2.5 py-1 text-[0.7rem] tracking-wide text-muted uppercase">
              {t("replay")}
            </span>
          </header>

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            // Scrollable, so it must be reachable from the keyboard too.
            tabIndex={0}
            className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-5"
          >
            {/* Before the first answer the window would be empty: say what happens. */}
            {messages.length === 1 && (
              <p className="m-auto max-w-sm px-4 py-6 text-center text-sm text-muted text-pretty">
                {t("chatEmpty")}
              </p>
            )}
            {/* Messages sit on the composer, like any chat, until they fill the window. */}
            <div className={`space-y-3 ${messages.length === 1 ? "" : "mt-auto"}`}>
              {messages.map((m) => (
                <Bubble key={m.id} from={m.from} label={m.from === "user" ? t("you") : t("window")}>
                  <p>{m.text}</p>
                  {m.price && <PriceCard price={m.price} />}
                </Bubble>
              ))}
              {step.kind === "busy" && (
                <div className="renova-in flex items-center gap-2.5 pl-1 text-sm text-muted">
                  <span aria-hidden className="renova-dots flex gap-1">
                    <span />
                    <span />
                    <span />
                  </span>
                  {t("thinking")}
                </div>
              )}
            </div>
          </div>

          {/* The composer: buttons and a filter instead of free text. */}
          <div className="border-t border-line bg-surface/50 px-5 py-4">
            {step.kind === "type" && (
              <div className="flex flex-wrap gap-2">
                {VEHICLE_TYPES.map((type) => (
                  <Chip key={type} onClick={() => pickType(type)}>
                    {t(`type_${type}`)}
                  </Chip>
                ))}
              </div>
            )}

            {list && (
              <>
                {list.kind !== "year" && (
                  <input
                    ref={filterRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={t("filterLabel")}
                    placeholder={list.kind === "brand" ? t("filterBrand") : t("filterModel")}
                    className="mb-3 w-full rounded-full border border-line bg-bg px-4 py-2 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
                  />
                )}
                <div className="flex max-h-[7.5rem] flex-wrap gap-2 overflow-y-auto overscroll-contain">
                  {shown.map((o) => (
                    <Chip
                      key={o.code}
                      onClick={() =>
                        list.kind === "brand"
                          ? pickBrand(list.type, o)
                          : list.kind === "model"
                            ? pickModel(list.type, list.brand, o)
                            : pickYear(list.type, list.brand, list.model, o)
                      }
                    >
                      {o.name}
                    </Chip>
                  ))}
                  {filtered.length > shown.length && (
                    <span className="self-center px-1 text-sm text-muted">
                      {t("moreOptions", { count: filtered.length - shown.length })}
                    </span>
                  )}
                  {filtered.length === 0 && (
                    <span className="text-sm text-muted">{t("noMatch", { query })}</span>
                  )}
                </div>
              </>
            )}

            {(step.kind === "done" || step.kind === "error") && (
              <div className="flex flex-wrap gap-2">
                {step.kind === "error" && (
                  <button type="button" onClick={step.retry} className="btn btn-primary">
                    {t("retry")}
                  </button>
                )}
                <button type="button" onClick={restart} className="btn btn-ghost">
                  {t("restart")}
                </button>
              </div>
            )}

            {step.kind === "busy" && <div aria-hidden className="h-[2.4rem]" />}
          </div>
        </section>

        {/* Behind the scenes */}
        <aside
          aria-labelledby="renova-panel"
          className="flex h-[26rem] flex-col border-t border-line bg-surface lg:h-full lg:min-h-0 lg:border-t-0 lg:border-l"
        >
          <div className="border-b border-line px-5 py-4">
            <h2 id="renova-panel" className="font-display text-lg tracking-tight">
              {t("panelTitle")}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{t("panelLead")}</p>
          </div>

          <ol
            ref={panelRef}
            tabIndex={0}
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
          >
            {/* Before the first call: the four tools, in the order they will be called. */}
            {calls.length === 0 &&
              TOOL_ORDER.map((name, i) => (
                <li
                  key={name}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3.5 font-mono text-[0.78rem]"
                >
                  <span className="font-sans text-xs text-muted tabular-nums">{i + 1}</span>
                  <span className="text-muted">{name}</span>
                  <span className="ml-auto font-sans text-xs text-muted">{t("pending")}</span>
                </li>
              ))}
            {calls.map((c) => (
              <li
                key={c.id}
                className="renova-in rounded-xl border border-line bg-bg p-3.5 font-mono text-[0.78rem] leading-relaxed"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-accent">{c.call.name}</span>
                  <span
                    className={`ml-auto font-sans text-xs ${c.status === "error" ? "text-ink" : "text-muted"}`}
                  >
                    {c.status === "running" && t("running")}
                    {c.status === "ok" && `✓ ${nf.format(c.ms!)} ms`}
                    {c.status === "error" && `✕ ${t("failed")}`}
                  </span>
                </div>
                <p className="mt-1 break-words text-muted">{formatArgs(c.call.args)}</p>
                {c.status === "ok" && (
                  <p className="mt-1.5 font-sans text-xs text-ink">
                    → {t("size", { count: c.count!, chars: nf.format(c.output!.length) })}
                  </p>
                )}
                {c.status === "error" && (
                  <p className="mt-1.5 break-words text-ink">→ &quot;{c.output}&quot;</p>
                )}
                {c.status === "ok" && <Answer text={c.output!} label={t("showAnswer")} />}
              </li>
            ))}
          </ol>

          <div className="border-t border-line px-5 py-4">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">{t("context")}</span>
              <span className="font-medium whitespace-nowrap tabular-nums">
                {t("contextValue", { chars: nf.format(contextChars) })}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted text-pretty">{t("contextNote")}</p>
          </div>
        </aside>
      </div>

      <p className="mt-4 max-w-3xl text-sm text-muted text-pretty">{t("disclaimer")}</p>
    </div>
  );
}

function Bubble({
  from,
  label,
  children,
}: {
  from: Message["from"];
  label: string;
  children: ReactNode;
}) {
  const mine = from === "user";
  return (
    <div className={`renova-in flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed text-pretty ${
          mine ? "rounded-br-md bg-ink text-bg" : "rounded-bl-md bg-surface text-ink"
        }`}
      >
        <span className="sr-only">{label}: </span>
        {children}
      </div>
    </div>
  );
}

function PriceCard({ price }: { price: Price }) {
  const t = useTranslations("Renova");
  return (
    <div className="mt-3 rounded-xl border border-line bg-bg px-4 py-3.5">
      <p className="text-xs tracking-wide text-muted uppercase">{t("priceLabel")}</p>
      <p className="mt-1 font-display text-3xl tracking-tight text-accent">{price.value}</p>
      <p className="mt-2 font-medium">
        {price.brand} {price.model}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
        <dt className="text-muted">{t("year")}</dt>
        <dd>{price.year}</dd>
        <dt className="text-muted">{t("fuel")}</dt>
        <dd>{price.fuel}</dd>
        <dt className="text-muted">{t("fipeCode")}</dt>
        <dd className="tabular-nums">{price.fipeCode}</dd>
      </dl>
    </div>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-full border border-line bg-bg px-3.5 py-1.5 text-sm transition-colors hover:border-ink focus-visible:border-ink"
    >
      {children}
    </button>
  );
}

function Answer({ text, label }: { text: string; label: string }) {
  const t = useTranslations("Renova");
  const { head, more } = preview(text);
  return (
    <details className="group mt-2 font-sans text-xs">
      <summary className="cursor-pointer text-muted select-none hover:text-ink">{label}</summary>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-2.5 font-mono text-[0.72rem] leading-snug text-ink">
        {head}
        {more > 0 && `\n${t("moreLines", { count: more })}`}
      </pre>
    </details>
  );
}
