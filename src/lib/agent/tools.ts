import { tool } from "ai";
import { z } from "zod";
import { getQuote } from "@/lib/sources/quote";
import { getRecentFilings, fetchFilingText } from "@/lib/sources/sec";

export const getQuoteTool = tool({
  description: "Get the current/latest stock quote (price, change, volume) for a ticker symbol.",
  inputSchema: z.object({
    ticker: z.string().describe("Stock ticker symbol, e.g. AAPL"),
  }),
  execute: async ({ ticker }) => {
    const quote = await getQuote(ticker);
    return quote ?? { error: `No quote found for ${ticker}` };
  },
});

export const searchFilingsTool = tool({
  description:
    "Search SEC EDGAR for a company's recent filings (10-K annual report, 10-Q quarterly report, or 8-K current report). Returns filing metadata including a URL to the document, not the document contents.",
  inputSchema: z.object({
    ticker: z.string().describe("Stock ticker symbol, e.g. AAPL"),
    formType: z.enum(["10-K", "10-Q", "8-K"]).describe("Which filing type to search for"),
  }),
  execute: async ({ ticker, formType }) => {
    const result = await getRecentFilings(ticker, [formType], 1);
    if (!result || result.filings.length === 0) {
      return { error: `No ${formType} filing found for ${ticker}` };
    }
    return { companyName: result.companyName, filing: result.filings[0] };
  },
});

export const fetchFilingTextTool = tool({
  description:
    "Download and extract the plain text of a specific SEC filing document, given its URL from searchFilings. The text may be truncated for length.",
  inputSchema: z.object({
    url: z.string().describe("The filing document URL returned by searchFilings"),
  }),
  execute: async ({ url }) => {
    const text = await fetchFilingText(url, 60000);
    return { text };
  },
});

export const briefingTools = {
  getQuote: getQuoteTool,
  searchFilings: searchFilingsTool,
  fetchFilingText: fetchFilingTextTool,
};
