import { task, logger } from "@trigger.dev/sdk";
import { runBriefingAgent } from "@/lib/agent/run";
import { db } from "@/lib/db";
import { briefings } from "@/lib/db/schema";

export const ingestBriefing = task({
  id: "ingest-briefing",
  maxDuration: 120,
  run: async (payload: { ticker: string }) => {
    const ticker = payload.ticker.toUpperCase();
    logger.info("Running briefing agent", { ticker });

    const result = await runBriefingAgent(ticker);

    const [row] = await db
      .insert(briefings)
      .values({
        ticker,
        companyName: result.companyName,
        quotePrice: result.quote?.price ?? null,
        quoteChangePct: result.quote?.changePct ?? null,
        quoteSource: result.quote?.source ?? null,
        quoteRaw: result.quote ?? null,
        filingForm: result.filing?.form ?? null,
        filingDate: result.filing?.date ?? null,
        filingUrl: result.filing?.url ?? null,
        briefingMarkdown: result.briefingMarkdown,
        toolCallLog: result.toolCallLog,
      })
      .returning();

    logger.info("Stored briefing", { id: row.id, ticker });

    return row;
  },
});
