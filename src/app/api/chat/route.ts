import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { briefingModel } from "@/lib/agent/run";
import { briefingTools } from "@/lib/agent/tools";
import { auth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an equity research assistant embedded in a wealth advisor's
workflow, answering questions in a live chat so the advisor can prep quickly before client
calls.

You have tools to fetch a live stock quote and to search and read a company's SEC filings
(10-K annual report, 10-Q quarterly report, 8-K current report). Ground every factual claim in
a tool result: call getQuote for price/quote questions, and searchFilings + fetchFilingText for
anything about the business, financials, risks, or recent developments. Never guess or rely on
outside knowledge for filing-specific or price facts — if the tools don't return what you need,
say so plainly rather than speculating.

When you use a filing, name its form type and filing date (e.g. "per the 10-K filed
2025-11-14") so the advisor can trace the claim back to its source. When you use a quote,
mention the source (e.g. Yahoo Finance).

Keep answers concise and skimmable — bullets over paragraphs — since the advisor may be reading
this between calls. Do not give investment advice or price targets.

If asked for a "full briefing" on a company, structure the answer with short sections: Business
Overview, Recent Developments, Financial Highlights, Key Risk Factors, and Talking Points for
Client Conversation. Otherwise just answer the question directly — you don't need to force that
structure on every reply.`;

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await request.json();
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  const result = streamText({
    model: briefingModel(),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: briefingTools,
    stopWhen: stepCountIs(8),
    onFinish: async ({ text, toolCalls, finishReason }) => {
      await getDb()
        .insert(auditLogs)
        .values({
          userId: user.id,
          userEmail: user.email,
          action: "chat.message",
          detail: {
            userMessage: lastUserMessage,
            assistantText: text,
            toolCalls: toolCalls.map((call) => ({
              tool: call.toolName,
              input: call.input,
            })),
            finishReason,
          },
        })
        .catch((err) => {
          console.error("Failed to write audit log", err);
        });
    },
  });

  return result.toUIMessageStreamResponse();
}
