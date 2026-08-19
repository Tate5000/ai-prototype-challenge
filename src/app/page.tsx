"use client";

import { useEffect, useRef, useState } from "react";
import { UserButton } from "@neondatabase/auth-ui";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  getToolName,
  type UIMessage,
  type ToolUIPart,
  type DynamicToolUIPart,
  type UITools,
} from "ai";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "Give me a full briefing on AAPL",
  "What's NVDA trading at right now?",
  "Any key risk factors in Tesla's latest 10-Q?",
  "How did JPMorgan's most recent quarter look?",
];

export default function Home() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function submit(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    sendMessage({ text: clean });
    setInput("");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      <Header />

      <div className="flex flex-1 flex-col gap-5 py-4">
        {messages.length === 0 && (
          <EmptyState onPick={submit} disabled={busy} />
        )}

        {messages.map((message) => (
          <MessageView key={message.id} message={message} />
        ))}

        {status === "submitted" && <ThinkingBubble />}

        {error && (
          <div className="flex items-start gap-2 self-start rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error.message || "Something went wrong. Try again."}</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="sticky bottom-4 mt-2 flex gap-2 rounded-xl border border-neutral-200 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a ticker, filing, or recent development…"
          className="flex-1 rounded-lg px-2.5 py-2 text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {busy ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
          {busy ? "Working…" : "Send"}
        </button>
      </form>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-2 pb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
            <TrendingUpIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">
            Advisor Copilot
          </span>
        </div>
        <UserButton />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Advisor Stock Briefing
      </h1>
      <p className="flex items-start gap-1.5 text-sm leading-relaxed text-neutral-500">
        <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
        Ask anything about a stock — every answer is grounded in a live quote or a real SEC
        filing, cited below the response.
      </p>
    </header>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (t: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-neutral-300 p-5 text-sm dark:border-neutral-700">
      <span className="text-neutral-500">Try asking:</span>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="w-fit rounded-full border border-neutral-200 px-3 py-1.5 text-left text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-neutral-100"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-center gap-2 self-start rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm text-neutral-500 dark:border-neutral-800">
      <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
      Thinking…
    </div>
  );
}

function MessageView({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    const text = message.parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("");
    return (
      <div className="self-end rounded-xl bg-neutral-900 px-3.5 py-2.5 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900">
        {text}
      </div>
    );
  }

  const sources = collectSources(message);

  return (
    <div className="flex max-w-full flex-col gap-2 self-start">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return part.text ? (
            <div
              key={i}
              className="prose prose-sm max-w-none rounded-xl border border-neutral-200 px-4 py-3 dark:prose-invert dark:border-neutral-800 prose-p:my-2 prose-ul:my-2 prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-sm prose-headings:font-semibold prose-headings:tracking-wide prose-headings:uppercase prose-headings:text-neutral-500 dark:prose-headings:text-neutral-400 prose-headings:first:mt-0"
            >
              <ReactMarkdown>{part.text}</ReactMarkdown>
            </div>
          ) : null;
        }
        if (isToolUIPart(part)) {
          return <ToolCard key={part.toolCallId ?? i} part={part} />;
        }
        return null;
      })}

      {sources.length > 0 && <SourceStrip sources={sources} />}
    </div>
  );
}

type ToolPart = ToolUIPart<UITools> | DynamicToolUIPart;

const TOOL_META: Record<string, { icon: (p: { className?: string }) => React.JSX.Element; label: string; doneLabel: string }> = {
  getQuote: { icon: TrendingUpIcon, label: "Fetching live quote", doneLabel: "Live quote" },
  searchFilings: { icon: FileTextIcon, label: "Searching SEC EDGAR", doneLabel: "Found filing" },
  fetchFilingText: { icon: BookOpenIcon, label: "Reading filing text", doneLabel: "Read filing" },
};

function ToolCard({ part }: { part: ToolPart }) {
  const name = getToolName(part);
  const meta = TOOL_META[name] ?? { icon: BotIcon, label: name, doneLabel: name };
  const Icon = meta.icon;
  const state = part.state;
  const done = state === "output-available";
  const failed = state === "output-error";

  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-neutral-50 px-3 py-2 text-xs dark:bg-neutral-900/60">
      <span className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
        ) : failed ? (
          <AlertIcon className="h-4 w-4 text-red-500" />
        ) : (
          <SpinnerIcon className="h-4 w-4 animate-spin text-neutral-400" />
        )}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
          <Icon className="h-3.5 w-3.5" />
          {done || failed ? meta.doneLabel : meta.label}
        </span>
        {done && <span className="text-neutral-500">{summarize(name, part.output)}</span>}
        {failed && <span className="text-red-500">{part.errorText ?? "Failed"}</span>}
      </span>
    </div>
  );
}

function summarize(tool: string, output: unknown): string {
  const o = output as Record<string, unknown> | null;
  if (!o) return "No result";
  if (typeof o.error === "string") return o.error;

  if (tool === "getQuote" && typeof o.price === "number") {
    const pct = typeof o.changePct === "number" ? ` (${o.changePct >= 0 ? "+" : ""}${o.changePct.toFixed(2)}%)` : "";
    return `$${o.price.toFixed(2)}${pct} · ${String(o.source ?? "")}`;
  }
  if (tool === "searchFilings" && o.filing) {
    const filing = o.filing as { form?: string; date?: string };
    return `${o.companyName ?? ""} — ${filing.form ?? ""} filed ${filing.date ?? ""}`;
  }
  if (tool === "fetchFilingText" && typeof o.text === "string") {
    return `${o.text.length.toLocaleString()} characters extracted`;
  }
  return "Done";
}

type Source = { label: string; href?: string };

function collectSources(message: UIMessage): Source[] {
  const sources: Source[] = [];
  const seen = new Set<string>();

  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue;
    const name = getToolName(part);
    const o = part.output as Record<string, unknown> | null;
    if (!o || o.error) continue;

    if (name === "getQuote" && typeof o.source === "string") {
      const key = `quote:${o.source}`;
      if (!seen.has(key)) {
        seen.add(key);
        const href = typeof o.sourceUrl === "string" ? o.sourceUrl : undefined;
        sources.push({ label: `${o.source} (live quote)`, href });
      }
    }
    if (name === "searchFilings" && o.filing) {
      const filing = o.filing as { form?: string; date?: string; url?: string };
      const key = `filing:${filing.url}`;
      if (filing.url && !seen.has(key)) {
        seen.add(key);
        sources.push({ label: `SEC ${filing.form ?? "filing"} — filed ${filing.date ?? ""}`, href: filing.url });
      }
    }
  }
  return sources;
}

function SourceStrip({ sources }: { sources: Source[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs text-neutral-500">
      <span className="text-neutral-400">Sources:</span>
      {sources.map((s, i) =>
        s.href ? (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 underline decoration-neutral-300 underline-offset-2 hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-800 dark:hover:text-neutral-100"
          >
            {s.label}
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        ) : (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 dark:border-neutral-800"
          >
            {s.label}
          </span>
        )
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 pt-4 text-xs text-neutral-400">
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

function SendIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
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

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5" />
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

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2Z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7Z" />
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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5Z" />
      <path d="m9 12 2 2 4-4" />
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
