import { asNumber } from "../chain";
import { mapPool } from "../pool";
import type { IndexMove, LiveQuote, QuoteProvider } from "../types";

const UA = "Mozilla/5.0";

async function chart(symbol: string, fetchImpl: typeof fetch): Promise<Record<string, unknown> | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const response = await fetchImpl(url, { headers: { "User-Agent": UA } });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
  };
  return data.chart?.result?.[0]?.meta ?? null;
}

function quoteFromMeta(ticker: string, meta: Record<string, unknown>): LiveQuote | null {
  const lastPrice = asNumber(meta.regularMarketPrice);
  const prev = asNumber(meta.chartPreviousClose) ?? asNumber(meta.previousClose);
  const volume = asNumber(meta.regularMarketVolume) ?? 0;
  if (!(lastPrice && lastPrice > 0)) return null;
  const changePct =
    asNumber(meta.regularMarketChangePercent) ??
    (prev && prev > 0 ? ((lastPrice - prev) / prev) * 100 : 0);
  return { ticker, lastPrice, changePct, volume };
}

async function krTicker(ticker: string, fetchImpl: typeof fetch): Promise<LiveQuote | null> {
  for (const suffix of [".KS", ".KQ"]) {
    const meta = await chart(`${ticker}${suffix}`, fetchImpl);
    const row = meta ? quoteFromMeta(ticker, meta) : null;
    if (row) return row;
  }
  return null;
}

export function createYahooProvider(fetchImpl: typeof fetch = fetch): QuoteProvider {
  return {
    name: "yahoo",
    async quotes(tickers) {
      const rows = await mapPool(tickers, 4, (ticker) => krTicker(ticker, fetchImpl));
      return rows.filter((row): row is LiveQuote => Boolean(row));
    },
    async indexes(): Promise<IndexMove> {
      const [kospi, kosdaq] = await Promise.all([chart("^KS11", fetchImpl), chart("^KQ11", fetchImpl)]);
      const pct = (meta: Record<string, unknown> | null) => {
        if (!meta) return null;
        const last = asNumber(meta.regularMarketPrice);
        const prev = asNumber(meta.chartPreviousClose) ?? asNumber(meta.previousClose);
        const direct = asNumber(meta.regularMarketChangePercent);
        if (direct != null) return direct;
        if (last && prev && prev > 0) return ((last - prev) / prev) * 100;
        return null;
      };
      return { kospi: pct(kospi), kosdaq: pct(kosdaq) };
    },
  };
}
