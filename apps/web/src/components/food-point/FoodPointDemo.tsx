"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { photos } from "@/content/photos";
import { DEMO_USER, createHost, type DemoHost, type LogEntry } from "./host";
import type { Mail } from "./server";

declare global {
  interface Window {
    /** Read by public/food-point-demo/shim.js, inside the iframe. */
    __foodPointDemo?: DemoHost;
  }
}

/** The 2024 index.html, plus the shim that connects it to this page. */
const APP_URL = "/food-point-demo/index.html";

/** Remembers, for this tab, that the visitor opened the app: a reload opens it again. */
const OPENED_KEY = "foodpoint-demo:opened";

/** The log keeps the latest requests only. */
const MAX_LOG = 80;

/** Enough for the 2024 loading states to show, as on a real network. */
const LATENCY_MS = 120;

const safeStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** The flag only changes by our own click, which re-renders anyway. */
const noSubscribe = () => () => {};

const wasOpened = () => {
  try {
    return window.sessionStorage.getItem(OPENED_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * The Food Point frontend of 2024, unchanged, in a frame. Its requests to
 * the Express API go to a server simulated on this page (`server.ts`), and
 * the panel beside it lists each one, as the network tab would.
 */
export function FoodPointDemo() {
  const t = useTranslations("FoodPoint");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale === "pt" ? "pt-BR" : "en-US"), [locale]);

  // The 2024 app weighs ~3 MB of images: it loads when the visitor asks for it.
  // A reload in the same tab opens it again (read after hydration: the server never knows).
  const [clicked, setClicked] = useState(false);
  const reopened = useSyncExternalStore(noSubscribe, wasOpened, () => false);
  const opened = clicked || reopened;
  const [frame, setFrame] = useState(0);
  const [path, setPath] = useState("/");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [mail, setMail] = useState<Mail | null>(null);
  const hostRef = useRef<DemoHost | null>(null);
  const panelRef = useRef<HTMLOListElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // The bridge must exist before the frame loads: the shim reads it first thing.
  useEffect(() => {
    const host = createHost({
      storage: safeStorage(),
      latency: LATENCY_MS,
      onLog: (entry) => setLog((l) => [...l.slice(-(MAX_LOG - 1)), entry]),
      onMail: setMail,
      onNavigate: setPath,
    });
    hostRef.current = host;
    window.__foodPointDemo = host;
    return () => {
      if (window.__foodPointDemo === host) delete window.__foodPointDemo;
    };
  }, []);

  // Only now load the app (again, after a reset: the frame is keyed).
  useEffect(() => {
    if (opened && frameRef.current) frameRef.current.src = APP_URL;
  }, [frame, opened]);

  function open() {
    setClicked(true);
    try {
      window.sessionStorage.setItem(OPENED_KEY, "1");
    } catch {
      // Without storage, a reload just shows the cover again.
    }
  }

  // Follow the log inside the panel, never by scrolling the page.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [log.length, mail]);

  /** The e-mail's link: the app's own navigation event, inside the frame. */
  function openResetPage() {
    const win = frameRef.current?.contentWindow as (Window & typeof globalThis) | null;
    if (!win) return;
    win.dispatchEvent(
      new win.CustomEvent("onstatechange", {
        detail: { path: "/forget-password", constructorInfo: {} },
      }),
    );
  }

  function reset() {
    hostRef.current?.reset();
    setLog([]);
    setMail(null);
    setFrame((f) => f + 1);
    open();
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-[96rem] px-5 sm:px-8">
      <div className="overflow-hidden rounded-[var(--radius-photo)] border border-line bg-bg shadow-[0_1px_0_var(--line),0_24px_60px_-40px_color-mix(in_oklab,var(--ink)_45%,transparent)] lg:grid lg:h-[clamp(36rem,calc(100svh-12rem),52rem)] lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* The 2024 app */}
        <section aria-labelledby="foodpoint-window" className="flex flex-col lg:min-h-0">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
            <span aria-hidden className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
            </span>
            <h2 id="foodpoint-window" className="font-medium">
              {t("window")}
            </h2>
            <span
              data-app-path
              className="min-w-0 flex-1 truncate rounded-full bg-surface px-3 py-1 font-mono text-xs text-muted"
            >
              <span className="sr-only">{t("address")}: </span>
              {path}
            </span>
            <span className="rounded-full border border-line px-2.5 py-1 text-[0.7rem] tracking-wide text-muted uppercase">
              {t("replay")}
            </span>
          </header>

          <div className="relative h-[min(44rem,78svh)] bg-surface lg:h-auto lg:min-h-0 lg:flex-1">
            {opened ? (
              <iframe
                key={frame}
                ref={frameRef}
                title={t("frameTitle")}
                className="block size-full border-0 bg-white"
              />
            ) : (
              // A screenshot of the app until the visitor opens it.
              <div className="absolute inset-0">
                <Image
                  src={photos.projectFoodPoint.src}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 70vw, 100vw"
                  className="object-cover object-top opacity-60 blur-[2px]"
                />
                <div className="absolute inset-0 grid place-items-center p-6">
                  <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-bg p-6 text-center shadow-sm ring-1 ring-line">
                    <button type="button" onClick={open} className="btn btn-primary">
                      {t("open")}
                    </button>
                    <p className="text-sm text-muted text-pretty">{t("openNote")}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* The simulated server */}
        <aside
          aria-labelledby="foodpoint-panel"
          className="flex h-[24rem] flex-col border-t border-line bg-surface lg:h-full lg:min-h-0 lg:border-t-0 lg:border-l"
        >
          <div className="border-b border-line px-5 py-4">
            <h2 id="foodpoint-panel" className="font-display text-lg tracking-tight">
              {t("panelTitle")}
            </h2>
            <p className="mt-0.5 text-sm text-muted text-pretty">{t("panelLead")}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
              <dt className="text-muted">{t("email")}</dt>
              <dd className="font-mono text-[0.8rem] break-all select-all">{DEMO_USER.email}</dd>
              <dt className="text-muted">{t("password")}</dt>
              <dd className="font-mono text-[0.8rem] select-all">{DEMO_USER.password}</dd>
            </dl>
          </div>

          <ol
            ref={panelRef}
            aria-label={t("logLabel")}
            tabIndex={0}
            className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3"
          >
            {log.length === 0 && (
              <li className="px-2 py-1 text-sm text-muted">{t("panelEmpty")}</li>
            )}
            {log.map((entry) => (
              <li
                key={entry.id}
                className="renova-in rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-[0.74rem] leading-relaxed"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-accent">{entry.method}</span>
                  <span className="min-w-0 flex-1 break-all text-ink">{entry.path}</span>
                </div>
                <details className="mt-1 font-sans text-xs">
                  <summary className="cursor-pointer text-muted select-none hover:text-ink">
                    <span className={entry.status >= 400 ? "font-medium text-ink" : ""}>
                      {entry.status}
                    </span>{" "}
                    · {nf.format(entry.ms)} ms
                  </summary>
                  {entry.request && (
                    <>
                      <p className="mt-2 text-muted">{t("requestBody")}</p>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-surface p-2 font-mono text-[0.7rem] leading-snug whitespace-pre-wrap text-ink">
                        {pretty(entry.request)}
                      </pre>
                    </>
                  )}
                  <p className="mt-2 text-muted">{t("responseBody")}</p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-surface p-2 font-mono text-[0.7rem] leading-snug whitespace-pre-wrap text-ink">
                    {pretty(entry.response)}
                  </pre>
                </details>
              </li>
            ))}
            {mail && (
              <li className="renova-in rounded-lg border border-accent/50 bg-bg px-3 py-2.5 text-sm">
                <p className="font-medium">{t("mailTitle")}</p>
                <p className="mt-1 text-xs text-muted text-pretty">
                  {t("mailLead", { to: mail.to })}
                </p>
                <p className="mt-2 font-mono text-base tracking-widest select-all">{mail.code}</p>
                <button
                  type="button"
                  onClick={openResetPage}
                  className="link-underline mt-2 cursor-pointer text-sm text-accent"
                >
                  {t("mailLink")}
                </button>
              </li>
            )}
          </ol>

          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="text-xs text-muted">{t("storage")}</p>
            <button type="button" onClick={reset} className="btn btn-ghost shrink-0 text-sm">
              {t("reset")}
            </button>
          </div>
        </aside>
      </div>

      <p className="mt-4 max-w-3xl text-sm text-muted text-pretty">{t("disclaimer")}</p>
    </div>
  );
}

/** JSON indented for reading; anything else as it came. */
function pretty(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
