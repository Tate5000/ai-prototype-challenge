# Advisor Stock Briefing

AI Prototype Challenge — Finance scenario. A wealth advisor types a ticker and gets a live
quote plus an AI-generated briefing sourced from the company's most recent SEC filing, in
under a minute.

## Architecture

```
Browser (Next.js UI)
   │  POST /api/briefing { ticker }
   ▼
Next.js Route Handler (Vercel)
   │  tasks.trigger("ingest-briefing", { ticker })
   │  polls run status until COMPLETED
   ▼
Trigger.dev task: ingest-briefing
   │  runs the research agent, then writes the result to Postgres
   ▼
Research Agent (Vercel AI SDK, Claude Sonnet 4.5 via Vercel AI Gateway)
   │  tool-calling loop, decides for itself which tools to call and when to stop
   ├─ getQuote        → Yahoo Finance (fallback: Stooq), no key required
   ├─ searchFilings    → SEC EDGAR submissions API, no key required
   └─ fetchFilingText  → downloads + strips the filing HTML to plain text
   ▼
Neon (serverless Postgres) — `briefings` table stores quote, filing metadata,
the generated markdown briefing, and a log of every tool call the agent made
   ▲
   └── Route Handler reads the finished run's output and returns it to the browser
```

The agent is not a fixed pipeline — it's given all three tools and a system prompt describing
the goal, and it decides which tools to call, in what order, and when it has enough information
to stop and write the briefing. The tool-call log is persisted so the reasoning is auditable.

## Stack

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind) — deployed on Vercel
- **Ingestion / orchestration runtime**: Trigger.dev — runs the agent as a durable background task
- **Database**: Neon (serverless Postgres) via Drizzle ORM
- **Model**: Claude Sonnet 4.5 via [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), called
  through the Vercel AI SDK. On Vercel, this authenticates automatically via OIDC — no key
  needed. Locally it falls back to a direct Anthropic API call if `ANTHROPIC_API_KEY` is set
  and `AI_GATEWAY_API_KEY` isn't (see `src/lib/agent/run.ts`).
- **Data sources**: SEC EDGAR (public, no key) for filings; Yahoo Finance / Stooq (public, no
  key) for quotes

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npx drizzle-kit push         # creates the `briefings` table in Neon
npx trigger.dev@latest dev   # runs the Trigger.dev worker locally
npm run dev                  # runs the Next.js app
```

Required environment variables (see `.env.example`):

| Variable | Where it comes from |
|---|---|
| `AI_GATEWAY_API_KEY` (local only) or `ANTHROPIC_API_KEY` (fallback) | Vercel AI Gateway dashboard, or an Anthropic key for local testing before a Vercel project exists |
| `DATABASE_URL` | Neon project connection string |
| `TRIGGER_SECRET_KEY` | Trigger.dev project settings (project ref is set in `trigger.config.ts`) |

For production, set `DATABASE_URL` and `TRIGGER_SECRET_KEY` in the Vercel project. Once deployed
on Vercel, AI Gateway auth is automatic (OIDC) — no `AI_GATEWAY_API_KEY` needed. Connect the
Trigger.dev project to the same Vercel deployment (or run `npx trigger.dev@latest deploy`).

## Notes / tradeoffs

- Quote and filing lookups use free, keyless public APIs (Yahoo Finance/Stooq, SEC EDGAR) —
  no data-source credentials needed to demo.
- The route handler polls the Trigger.dev run synchronously (up to 55s) rather than wiring up
  realtime subscriptions, to keep the demo path simple and robust under interview time
  pressure. Swapping in `@trigger.dev/react-hooks` for live status streaming is a natural next
  step, not a redesign.
- Filing text is truncated to ~60k characters before being sent to the model to keep the
  agent's context and latency bounded; a production version would chunk + retrieve relevant
  sections instead of truncating.
