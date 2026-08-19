export interface Quote {
  ticker: string;
  price: number;
  change: number | null;
  changePct: number | null;
  currency: string;
  exchange: string | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  source: string;
  sourceUrl: string;
}

const HEADERS = { "User-Agent": "Mozilla/5.0 (advisor-briefing-tool)" };

export async function getQuote(ticker: string): Promise<Quote | null> {
  return (await getQuoteYahoo(ticker)) ?? (await getQuoteStooq(ticker));
}

async function getQuoteYahoo(ticker: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
      { headers: HEADERS }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice == null) return null;

    const price = meta.regularMarketPrice as number;
    const prevClose = (meta.chartPreviousClose ?? meta.previousClose) as number | undefined;
    const change = prevClose != null ? price - prevClose : null;
    const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;

    return {
      ticker: meta.symbol ?? ticker.toUpperCase(),
      price: round2(price),
      change: change != null ? round2(change) : null,
      changePct: changePct != null ? round2(changePct) : null,
      currency: meta.currency ?? "USD",
      exchange: meta.exchangeName ?? null,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      volume: meta.regularMarketVolume ?? null,
      source: "Yahoo Finance",
      sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(meta.symbol ?? ticker.toUpperCase())}`,
    };
  } catch {
    return null;
  }
}

async function getQuoteStooq(ticker: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://stooq.com/q/l/?s=${encodeURIComponent(ticker.toLowerCase())}.us&f=sd2t2ohlcv&h&e=csv`,
      { headers: HEADERS }
    );
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    const lines = text.split("\n");
    if (lines.length < 2) return null;
    const header = lines[0].split(",");
    const values = lines[1].split(",");
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = values[i]));

    const close = row["Close"];
    if (!close || close === "N/D") return null;

    return {
      ticker: ticker.toUpperCase(),
      price: parseFloat(close),
      change: null,
      changePct: null,
      currency: "USD",
      exchange: null,
      dayHigh: row["High"] && row["High"] !== "N/D" ? parseFloat(row["High"]) : null,
      dayLow: row["Low"] && row["Low"] !== "N/D" ? parseFloat(row["Low"]) : null,
      volume: row["Volume"] && row["Volume"] !== "N/D" ? parseInt(row["Volume"], 10) : null,
      source: "Stooq",
      sourceUrl: `https://stooq.com/q/?s=${encodeURIComponent(ticker.toLowerCase())}.us`,
    };
  } catch {
    return null;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
