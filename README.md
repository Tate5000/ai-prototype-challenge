# Advisor Stock Briefing

**Live app:** [ai-prototype-challenge.vercel.app](https://ai-prototype-challenge.vercel.app)
— sign in with your email (magic link, no password) to use it.

AI Prototype Challenge — Finance scenario. A wealth advisor chats with an AI research assistant
that looks up live quotes and reads SEC filings on demand, so they can prep for client calls in
minutes instead of hours. A secondary one-shot form (ticker in, persisted briefing out) is also
available, backed by a Trigger.dev background task.

## Architecture

```
Browser (Next.js UI, chat interface via @ai-sdk/react useChat)
   │  POST /api/chat { messages }   — requires a signed-in Neon Auth session
   ▼
Next.js Route Handler (Vercel)
   │  streamText() tool-calling loop, streamed back to the browser
   ├─ getQuote        → Yahoo Finance (fallback: Stooq), no key required
   ├─ searchFilings    → SEC EDGAR submissions API, no key required
   └─ fetchFilingText  → downloads + strips the filing HTML to plain text
   │
   │  on each finished turn, writes an audit log row: who (Neon Auth user),
   │  what they asked, what the model answered, which tools were called, when
   ▼
Neon (serverless Postgres) — `audit_logs` table, via Drizzle ORM
```

A secondary path (`/api/briefing`, also gated behind a signed-in session) triggers the same
tool-calling agent as a durable Trigger.dev background task (`src/trigger/ingest-briefing.ts`),
which writes a persisted, structured record to the `briefings` table instead of streaming to
the browser — useful for a saved/shareable briefing rather than a live conversation.

Research Agent: Vercel AI SDK, Claude Sonnet 4.5 via Vercel AI Gateway. It's given all three
tools and a system prompt describing the goal, and decides for itself which tools to call, in
what order, and when it has enough information to answer.

Auth: Neon Auth (managed [Better Auth](https://better-auth.com)) gates the whole app —
`src/proxy.ts` (Next.js 16's Proxy, formerly Middleware) redirects unauthenticated requests to
`/auth/sign-in`, and `/api/chat` additionally checks for a signed-in session server-side before
running the agent — unauthenticated requests get a 401. Sign-in is **magic-link only** (password
sign-in is disabled via `credentials={false}` on `NeonAuthUIProvider` in `src/app/layout.tsx`).

Audit log: every completed chat turn is written to `audit_logs` (`src/lib/db/schema.ts`) with
the user's id/email, their message, the assistant's reply, the tools it called and their inputs,
and a timestamp — so it's possible to answer "who asked what, and when."

## Stack

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind) — deployed on Vercel
- **Auth**: Neon Auth (managed Better Auth) — magic-link session cookies, gates the app via
  `src/proxy.ts` and `/api/chat`
- **Ingestion / orchestration runtime** (secondary path): Trigger.dev — runs the agent as a
  durable background task for the `/api/briefing` form
- **Database**: Neon (serverless Postgres) via Drizzle ORM — `audit_logs` and `briefings` tables
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
npx drizzle-kit push         # creates the `briefings` and `audit_logs` tables in Neon
npx trigger.dev@latest dev   # only needed for the secondary /api/briefing path
npm run dev                  # runs the Next.js app
```

Required environment variables (see `.env.example`):

| Variable | Where it comes from |
|---|---|
| `AI_GATEWAY_API_KEY` (local only) or `ANTHROPIC_API_KEY` (fallback) | Vercel AI Gateway dashboard, or an Anthropic key for local testing before a Vercel project exists |
| `DATABASE_URL` | Neon project connection string |
| `NEON_AUTH_BASE_URL` | Neon console → your project → Auth tab → Enable Auth → "Auth URL" |
| `NEON_AUTH_COOKIE_SECRET` | Generate locally: `openssl rand -base64 32` (not from the dashboard) |
| `TRIGGER_SECRET_KEY` | Only needed for the secondary `/api/briefing` + `ingest-briefing` Trigger.dev task; not required for the chat flow |

For production, set `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and `NEON_AUTH_COOKIE_SECRET` in the
Vercel project. Once deployed on Vercel, AI Gateway auth is automatic (OIDC) — no
`AI_GATEWAY_API_KEY` needed. For the Trigger.dev path to work on a live deployment, use a
**production** `TRIGGER_SECRET_KEY` (from `npx trigger.dev@latest deploy`) — the `dev` key only
works with a local `npx trigger.dev dev` session.

To send magic-link emails from your own domain (e.g. via Resend) instead of Neon's shared
sender, configure it in the Neon console under Auth → Authentication → Configure email
provider — dashboard-only, no app code changes needed.

## Notes / tradeoffs

- Quote and filing lookups use free, keyless public APIs (Yahoo Finance/Stooq, SEC EDGAR) —
  no data-source credentials needed to demo.
- The `/api/briefing` route polls the Trigger.dev run synchronously (up to 55s) rather than
  wiring up realtime subscriptions, to keep that path simple. The chat path streams instead and
  doesn't have this limitation.
- Filing text is truncated to ~60k characters before being sent to the model to keep the
  agent's context and latency bounded; a production version would chunk + retrieve relevant
  sections instead of truncating.
