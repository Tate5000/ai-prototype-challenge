import { tasks, runs } from "@trigger.dev/sdk";
import type { ingestBriefing } from "@/trigger/ingest-briefing";

export const maxDuration = 60;

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "CANCELED",
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
  "EXPIRED",
  "TIMED_OUT",
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ticker = typeof body?.ticker === "string" ? body.ticker.trim() : "";

  if (!ticker) {
    return Response.json({ error: "ticker is required" }, { status: 400 });
  }

  const handle = await tasks.trigger<typeof ingestBriefing>("ingest-briefing", { ticker });

  const start = Date.now();
  const timeoutMs = 55_000;

  while (Date.now() - start < timeoutMs) {
    const run = await runs.retrieve(handle.id);
    if (TERMINAL_STATUSES.has(run.status)) {
      if (run.status === "COMPLETED") {
        return Response.json({ status: run.status, output: run.output });
      }
      return Response.json(
        { status: run.status, error: run.error ?? "Briefing run did not complete" },
        { status: 502 }
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return Response.json({ status: "TIMED_OUT", runId: handle.id }, { status: 202 });
}
