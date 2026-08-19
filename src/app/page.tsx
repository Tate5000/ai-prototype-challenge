"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Briefing } from "@/lib/db/schema";

type ToolCallLogEntry = { tool: string; input: unknown; output: unknown };

type FetchState =
  | { phase: "idle" }
  | { phase: "loading"; ticker: string; startedAt: number }
  | { phase: "error"; ticker: string; message: string }
  | { phase: "done"; briefing: Briefing };

const QUICK_TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "JPM"];

const STEPS = [
  { key: "quote", tool: "getQuote", label: "Fetching live quote", threshold: 0 },
  { key: "search", tool: "searchFilings", label: "Searching SEC EDGAR", threshold: 2500 },
  { key: "read", tool: "fetchFilingText", label: "Reading filing text", threshold: 7000 },
  { key: "write", tool: null, label: "Drafting briefing", threshold: 20000 },
] as const;

export default function Home() {
  const [ticker, setTicker] = useState("AAPL");
  const [state, setState] = useState<FetchState>({ phase: "idle" });

  async function runBriefing(t: string) {
    const clean = t.trim().toUpperCase();
    if (!clean) return;
    setTicker(clean);
    setState({ phase: "loading", ticker: clean, startedAt: Date.now() });

    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: clean }),
      });
      const json = await res.json();

      if (res.status === 202) {
        setState({
          phase: "error",
          ticker: clean,
          message: "The agent is still working after 55s — Trigger.dev may not have a dev worker running. Try again shortly.",
        });
        return;
      }
      if (!res.ok || !json.output) {
        setState({ phase: "error", ticker: clean, message: json.error ?? "Something went wrong." });
        return;
      }
      setState({ phase: "done", briefing: json.output as Briefing });
    } catch {
      setState({
        phase: "error",
        ticker: clean,
        message: "Network error — is the backend reachable?",
      });
    }
  }

  const loading = state.phase === "loading";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 sm:py-14">
      <Header />

      <SearchPanel
        ticker={ticker}
        setTicker={setTicker}
        loading={loading}
        onSubmit={(t) => runBriefing(t)}
      />

      {state.phase === "error" && <ErrorBanner message={state.message} />}

      {(state.phase === "loading" || state.phase === "done") && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="order-2 flex flex-col gap-6 lg:order-1">
            {state.phase === "done" ? <BriefingView briefing={state.briefing} /> : <BriefingSkeleton />}
          </div>
          <div className="order-1 lg:order-2 lg:sticky lg:top-6">
            <AgentTrail state={state} />
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
          <TrendingUpIcon className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Advisor Copilot
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Advisor Stock Briefing
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-neutral-500">
          An AI research agent pulls a live quote and reads the company&apos;s latest SEC filing,
          then writes a client-ready briefing in under a minute.
        </p>
      </div>
    </header>
  );
}

function SearchPanel({
  ticker,
  setTicker,
  loading,
  onSubmit,
}: {
  ticker: string;
  setTicker: (t: string) => void;
  loading: boolean;
  onSubmit: (t: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(ticker);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Ticker, e.g. AAPL"
            className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm font-medium tracking-wide uppercase outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/10"
            maxLength={10}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-w-[9.5rem] items-center justify-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {loading && <SpinnerIcon className="h-4 w-4 animate-spin" />}
          {loading ? "Researching…" : "Get Briefing"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-400">Try:</span>
        {QUICK_TICKERS.map((t) => (
          <button
            key={t}
            type="button"
            disabled={loading}
            onClick={() => {
              setTicker(t);
              onSubmit(t);
            }}
            className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-100"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function BriefingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="animate-pulse rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="h-5 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-3 h-8 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-2 h-3 w-56 rounded bg-neutral-100 dark:bg-neutral-800/60" />
      </div>
      <div className="animate-pulse rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-neutral-100 dark:bg-neutral-800/60"
              style={{ width: `${85 - (i % 3) * 18}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BriefingView({ briefing }: { briefing: Briefing }) {
  const quoteRaw = (briefing.quoteRaw ?? null) as Record<string, unknown> | null;
  const up = (briefing.quoteChangePct ?? 0) >= 0;

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-semibold">
            {briefing.companyName ?? briefing.ticker}{" "}
            <span className="text-neutral-400">({briefing.ticker})</span>
          </h2>
          {briefing.filingUrl && (
            <a
              href={briefing.filingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              {briefing.filingForm} filed {briefing.filingDate}
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
        </div>

        {briefing.quotePrice != null && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-3xl font-semibold tabular-nums">
              ${briefing.quotePrice.toFixed(2)}
            </span>
            {briefing.quoteChangePct != null && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                  up
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                }`}
              >
                {up ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
                {up ? "+" : ""}
                {briefing.quoteChangePct.toFixed(2)}%
              </span>
            )}
            <span className="text-xs text-neutral-400">{briefing.quoteSource}</span>
          </div>
        )}

        {quoteRaw && (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-neutral-100 pt-4 text-xs sm:grid-cols-4 dark:border-neutral-800">
            <Stat label="Day high" value={fmtNum(quoteRaw.dayHigh)} />
            <Stat label="Day low" value={fmtNum(quoteRaw.dayLow)} />
            <Stat label="Volume" value={fmtVolume(quoteRaw.volume)} />
            <Stat label="Exchange" value={typeof quoteRaw.exchange === "string" ? quoteRaw.exchange : "—"} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h2:mt-5 prose-h2:text-sm prose-h2:tracking-wide prose-h2:uppercase prose-h2:text-neutral-500 dark:prose-h2:text-neutral-400 prose-h2:first:mt-0">
          <ReactMarkdown>{briefing.briefingMarkdown}</ReactMarkdown>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-neutral-400">{label}</span>
      <span className="font-mono font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
        {value}
      </span>
    </div>
  );
}

function fmtNum(v: unknown): string {
  return typeof v === "number" ? `$${v.toFixed(2)}` : "—";
}

function fmtVolume(v: unknown): string {
  if (typeof v !== "number") return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function AgentTrail({ state }: { state: Extract<FetchState, { phase: "loading" | "done" }> }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state.phase !== "loading") return;
    const id = setInterval(() => setElapsed(Date.now() - state.startedAt), 200);
    return () => clearInterval(id);
  }, [state]);

  const toolLog: ToolCallLogEntry[] =
    state.phase === "done" ? ((state.briefing.toolCallLog as ToolCallLogEntry[] | null) ?? []) : [];

  const activeIndex =
    state.phase === "loading"
      ? STEPS.reduce((idx, step, i) => (elapsed >= step.threshold ? i : idx), 0)
      : STEPS.length - 1;

  const progressPct =
    state.phase === "done" ? 100 : Math.min(100, (activeIndex / (STEPS.length - 1)) * 100);

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
          <BotIcon className="h-3.5 w-3.5" />
          Agent activity
        </h3>
        {state.phase === "loading" && (
          <span className="font-mono text-xs tabular-nums text-neutral-400">
            {(elapsed / 1000).toFixed(0)}s
          </span>
        )}
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full rounded-full bg-neutral-900 transition-all duration-500 ease-out dark:bg-neutral-100"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const status: "done" | "active" | "pending" =
            state.phase === "done"
              ? "done"
              : i < activeIndex
                ? "done"
                : i === activeIndex
                  ? "active"
                  : "pending";
          const entry = step.tool ? toolLog.find((e) => e.tool === step.tool) : undefined;
          return (
            <li key={step.key} className="flex items-start gap-2.5">
              <StepIcon status={status} />
              <div className="flex flex-col">
                <span
                  className={`text-sm ${
                    status === "pending"
                      ? "text-neutral-400"
                      : "font-medium text-neutral-800 dark:text-neutral-200"
                  }`}
                >
                  {step.label}
                </span>
                {status === "done" && entry && (
                  <span className="text-xs text-neutral-400">{summarizeEntry(entry)}</span>
                )}
                {status === "done" && step.key === "write" && (
                  <span className="text-xs text-neutral-400">Briefing generated</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {state.phase === "done" && toolLog.length > 0 && (
        <details className="group mt-1 border-t border-neutral-200 pt-3 text-xs dark:border-neutral-800">
          <summary className="flex cursor-pointer list-none items-center justify-between text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
            <span>View raw tool calls ({toolLog.length})</span>
            <ChevronDownIcon className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto">
            {toolLog.map((entry, i) => (
              <pre
                key={i}
                className="overflow-x-auto rounded-md bg-neutral-900 p-2 font-mono text-[10px] leading-snug text-neutral-200 dark:bg-black"
              >
                <span className="text-emerald-400">{entry.tool}</span>
                {"\n"}
                {truncateJson(entry.output)}
              </pre>
            ))}
          </div>
        </details>
      )}
    </aside>
  );
}

function summarizeEntry(entry: ToolCallLogEntry): string {
  const output = entry.output as Record<string, unknown> | null;
  if (!output || output.error) return typeof output?.error === "string" ? output.error : "No result";

  if (entry.tool === "getQuote" && typeof output.price === "number") {
    return `$${output.price.toFixed(2)} · ${String(output.source ?? "")}`;
  }
  if (entry.tool === "searchFilings" && output.filing) {
    const filing = output.filing as { form?: string; date?: string };
    return `${filing.form ?? ""} filed ${filing.date ?? ""}`;
  }
  if (entry.tool === "fetchFilingText" && typeof output.text === "string") {
    return `${output.text.length.toLocaleString()} chars extracted`;
  }
  return "Done";
}

function truncateJson(value: unknown, max = 600): string {
  try {
    const str = JSON.stringify(value, null, 2) ?? "null";
    return str.length > max ? str.slice(0, max) + "\n…" : str;
  } catch {
    return "—";
  }
}

function StepIcon({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <CheckIcon className="h-2.5 w-2.5" />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <SpinnerIcon className="h-4 w-4 animate-spin text-neutral-500" />
      </span>
    );
  }
  return (
    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
    </span>
  );
}

function Footer() {
  return (
    <footer className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-8 text-xs text-neutral-400">
      <span>Data: SEC EDGAR (public filings) + Yahoo Finance/Stooq (quotes).</span>
      <span aria-hidden>·</span>
      <span>Not investment advice.</span>
    </footer>
  );
}

/* --- icons --- */

function iconProps(className?: string) {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M21 12a9 9 0 1 1-9-9" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)} strokeWidth={3}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14 21 3" />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4M8 16v0M16 16v0" />
    </svg>
  );
}
