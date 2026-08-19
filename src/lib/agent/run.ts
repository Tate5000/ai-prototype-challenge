import { createOpenAI } from "@ai-sdk/openai";
import { generateText, stepCountIs } from "ai";
import { briefingTools } from "./tools";
import type { Quote } from "@/lib/sources/quote";
import type { FilingMeta } from "@/lib/sources/sec";

const SYSTEM_PROMPT = `You are an equity research assistant helping a wealth management advisor
get up to speed on a stock before a client call. You have tools to fetch a live quote and to
search and read a company's SEC filings. Decide for yourself which tools to call and in what
order to gather what you need — you do not need to call every tool.

A typical approach: get the quote, search for the most relevant recent filing (prefer 10-K for
a full picture, 10-Q for the latest quarter, 8-K for a specific recent event), then fetch its
text and read it before writing the briefing. If a tool call fails or returns no data, adapt
and continue with what you have rather than giving up.

Once you have gathered enough information, STOP calling tools and produce a concise, structured
briefing an advisor can skim in under a minute. Be factual and only use information present in
the tool results — if something isn't covered, say so briefly rather than guessing. Do not give
investment advice or price targets.

Respond with markdown in exactly this structure:

## Business Overview
2-3 sentences on what the company does and its primary revenue drivers.

## Recent Developments
2-4 bullets on notable recent events, strategic moves, or management commentary from the filing.

## Financial Highlights
2-4 bullets on key financial figures/trends from the filing (revenue, margins, cash position, guidance).

## Key Risk Factors
2-4 bullets on the most material risks disclosed.

## Talking Points for Client Conversation
2-3 bullets an advisor could use to frame a conversation with a client about this stock.`;

function portkeyModel() {
  const openai = createOpenAI({
    baseURL: process.env.PORTKEY_API_URL,
    apiKey: process.env.PORTKEY_API_KEY,
  });
  const modelId =
    process.env.PORTKEY_MODEL ?? "@aws-bedrock-use2/us.anthropic.claude-sonnet-4-5-20250929-v1:0";
  return openai.chat(modelId);
}

export interface BriefingRunResult {
  briefingMarkdown: string;
  companyName: string | null;
  quote: Quote | null;
  filing: FilingMeta | null;
  toolCallLog: Array<{ tool: string; input: unknown; output: unknown }>;
}

export async function runBriefingAgent(ticker: string): Promise<BriefingRunResult> {
  const result = await generateText({
    model: portkeyModel(),
    system: SYSTEM_PROMPT,
    prompt: `Prepare an advisor briefing for ticker ${ticker.toUpperCase()}.`,
    tools: briefingTools,
    stopWhen: stepCountIs(8),
  });

  const toolCallLog = result.toolResults.map((r) => ({
    tool: r.toolName,
    input: r.input,
    output: r.output,
  }));

  let quote: Quote | null = null;
  let filing: FilingMeta | null = null;
  let companyName: string | null = null;

  for (const r of result.toolResults) {
    const output = r.output as Record<string, unknown>;
    if (r.toolName === "getQuote" && output && !output.error) {
      quote = output as unknown as Quote;
    }
    if (r.toolName === "searchFilings" && output && !output.error) {
      filing = output.filing as FilingMeta;
      companyName = output.companyName as string;
    }
  }

  return {
    briefingMarkdown: result.text,
    companyName,
    quote,
    filing,
    toolCallLog,
  };
}
