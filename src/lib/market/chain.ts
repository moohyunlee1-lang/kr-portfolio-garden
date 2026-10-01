import { QUOTE_BATCH_LIMIT } from "./session";
import type { IndexMove, LiveQuote, QuoteLike, QuoteProvider } from "./types";

export function parseTickerQuery(raw: string | null | undefined, limit = QUOTE_BATCH_LIMIT): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw ?? "").split(/[,\s]+/)) {
    const ticker = part.trim().toUpperCase();
    if (!/^[0-9A-Z]{6}$/.test(ticker) || seen.has(ticker)) continue;
    seen.add(ticker);
    out.push(ticker);
    if (out.length >= limit) break;
  }
  return out;
}

export async function fillQuotes(
  tickers: string[],
  providers: QuoteProvider[],
): Promise<{ quotes: LiveQuote[]; source: Record<string, string> }> {
  const source: Record<string, string> = {};
  const byTicker = new Map<string, LiveQuote>();
  let missing = [...tickers];
  for (const provider of providers) {
    if (!missing.length) break;
    try {
      const rows = await provider.quotes(missing);
      for (const row of rows) {
        if (!missing.includes(row.ticker) || !(row.lastPrice > 0) || byTicker.has(row.ticker)) continue;
        byTicker.set(row.ticker, row);
        source[row.ticker] = provider.name;
      }
      missing = missing.filter((ticker) => !byTicker.has(ticker));
    } catch {
      continue;
    }
  }
  return { quotes: tickers.map((ticker) => byTicker.get(ticker)).filter((row): row is LiveQuote => Boolean(row)), source };
}

export async function fillIndexes(providers: QuoteProvider[]): Promise<IndexMove & { source: Record<string, string> }> {
  let kospi: number | null = null;
  let kosdaq: number | null = null;
  const source: Record<string, string> = {};
  for (const provider of providers) {
    if (kospi != null && kosdaq != null) break;
    try {
      const row = await provider.indexes();
      if (kospi == null && typeof row.kospi === "number" && Number.isFinite(row.kospi)) {
        kospi = row.kospi;
        source.kospi = provider.name;
      }
      if (kosdaq == null && typeof row.kosdaq === "number" && Number.isFinite(row.kosdaq)) {
        kosdaq = row.kosdaq;
        source.kosdaq = provider.name;
      }
    } catch {
      continue;
    }
  }
  return { kospi, kosdaq, source };
}

export function applyLiveQuotes<T extends QuoteLike>(
  base: Record<string, T>,
  live: LiveQuote[],
): Record<string, T> {
  const next = { ...base };
  for (const row of live) {
    const current = next[row.ticker];
    if (!current || !(row.lastPrice > 0)) continue;
    next[row.ticker] = {
      ...current,
      lastPrice: row.lastPrice,
      changePct: row.changePct,
      volume: row.volume,
    };
  }
  return next;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
