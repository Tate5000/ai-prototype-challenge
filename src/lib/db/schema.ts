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

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email"),
  action: text("action").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
