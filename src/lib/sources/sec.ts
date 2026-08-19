const USER_AGENT = "AI Prototype Challenge advisor-briefing-tool contact@example.com";
const HEADERS = { "User-Agent": USER_AGENT };

const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";

export interface FilingMeta {
  form: string;
  date: string;
  accession: string;
  url: string;
}

let tickerCache: Map<string, string> | null = null;

async function loadTickerMap(): Promise<Map<string, string>> {
  if (tickerCache) return tickerCache;
  const res = await fetch(TICKER_MAP_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to load SEC ticker map: ${res.status}`);
  const data = (await res.json()) as Record<string, { ticker: string; cik_str: number }>;
  tickerCache = new Map(
    Object.values(data).map((v) => [v.ticker.toUpperCase(), String(v.cik_str).padStart(10, "0")])
  );
  return tickerCache;
}

export async function tickerToCik(ticker: string): Promise<string | null> {
  const map = await loadTickerMap();
  return map.get(ticker.toUpperCase()) ?? null;
}

export async function getRecentFilings(
  ticker: string,
  forms: string[] = ["10-K", "10-Q", "8-K"],
  limit = 5
): Promise<{ companyName: string; filings: FilingMeta[] } | null> {
  const cik = await tickerToCik(ticker);
  if (!cik) return null;

  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to load SEC submissions: ${res.status}`);
  const data = await res.json();
  const companyName: string = data.name ?? ticker;

  const recent = data.filings.recent;
  const filings: FilingMeta[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    const form = recent.form[i];
    if (!forms.includes(form)) continue;
    const accession: string = recent.accessionNumber[i];
    const accessionNoDash = accession.replace(/-/g, "");
    const primaryDoc: string = recent.primaryDocument[i];
    const cikInt = parseInt(cik, 10);
    const url = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accessionNoDash}/${primaryDoc}`;
    filings.push({ form, date: recent.filingDate[i], accession, url });
    if (filings.length >= limit) break;
  }

  return { companyName, filings };
}

export async function fetchFilingText(url: string, maxChars = 60000): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch filing: ${res.status}`);
  let text = await res.text();
  text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;|&#160;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text.slice(0, maxChars);
}
