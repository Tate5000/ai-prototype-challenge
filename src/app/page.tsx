"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Briefing } from "@/lib/db/schema";

type FetchState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; briefing: Briefing };

export default function Home() {
  const [ticker, setTicker] = useState("AAPL");
  const [state, setState] = useState<FetchState>({ phase: "idle" });

  async function runBriefing(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim()) return;
    setState({ phase: "loading" });

    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase() }),
      });
      const json = await res.json();

      if (!res.ok) {
        setState({ phase: "error", message: json.error ?? "Something went wrong." });
        return;
      }
      setState({ phase: "done", briefing: json.output as Briefing });
    } catch {
      setState({ phase: "error", message: "Network error — is the backend reachable?" });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Advisor Stock Briefing</h1>
        <p className="text-sm text-neutral-500">
          An AI research agent fetches a live quote and reads the company&apos;s latest SEC
          filing to prep you before a client call.
        </p>
      </header>

      <form onSubmit={runBriefing} className="flex gap-2">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Ticker, e.g. AAPL"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm uppercase outline-none focus:border-neutral-500 dark:border-neutral-700"
          maxLength={10}
        />
        <button
          type="submit"
          disabled={state.phase === "loading"}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {state.phase === "loading" ? "Researching…" : "Get Briefing"}
        </button>
      </form>

      {state.phase === "loading" && (
        <p className="text-sm text-neutral-500">
          Agent is fetching the quote, searching EDGAR, and reading the filing — this can take
          30-60s.
        </p>
      )}

      {state.phase === "error" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      )}

      {state.phase === "done" && <BriefingView briefing={state.briefing} />}

      <footer className="mt-auto pt-8 text-xs text-neutral-400">
        Data: SEC EDGAR (public filings) + Yahoo Finance/Stooq (quotes). Not investment advice.
      </footer>
    </main>
  );
}

function BriefingView({ briefing }: { briefing: Briefing }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div>
        <h2 className="text-lg font-semibold">
          {briefing.companyName ?? briefing.ticker} ({briefing.ticker})
        </h2>
        {briefing.quotePrice != null && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            ${briefing.quotePrice.toFixed(2)}
            {briefing.quoteChangePct != null && (
              <span className={briefing.quoteChangePct >= 0 ? "text-green-600" : "text-red-600"}>
                {" "}
                ({briefing.quoteChangePct >= 0 ? "+" : ""}
                {briefing.quoteChangePct.toFixed(2)}%)
              </span>
            )}
            <span className="text-neutral-400"> · {briefing.quoteSource}</span>
          </p>
        )}
        {briefing.filingUrl && (
          <p className="text-xs text-neutral-500">
            Source: {briefing.filingForm} filed {briefing.filingDate} —{" "}
            <a
              href={briefing.filingUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              view on EDGAR
            </a>
          </p>
        )}
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{briefing.briefingMarkdown}</ReactMarkdown>
      </div>
    </section>
  );
}
