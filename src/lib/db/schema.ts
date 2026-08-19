import { pgTable, text, timestamp, uuid, jsonb, real } from "drizzle-orm/pg-core";

export const briefings = pgTable("briefings", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticker: text("ticker").notNull(),
  companyName: text("company_name"),

  quotePrice: real("quote_price"),
  quoteChangePct: real("quote_change_pct"),
  quoteSource: text("quote_source"),
  quoteRaw: jsonb("quote_raw"),

  filingForm: text("filing_form"),
  filingDate: text("filing_date"),
  filingUrl: text("filing_url"),

  briefingMarkdown: text("briefing_markdown"),
  toolCallLog: jsonb("tool_call_log"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Briefing = typeof briefings.$inferSelect;
export type NewBriefing = typeof briefings.$inferInsert;
