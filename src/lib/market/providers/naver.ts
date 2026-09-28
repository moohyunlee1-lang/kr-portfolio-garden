import { asNumber } from "../chain";
import { mapPool } from "../pool";
import type { IndexMove, LiveQuote, QuoteProvider } from "../types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const HEADERS = { "User-Agent": UA, Referer: "https://m.stock.naver.com/" };

async function jsonGet(url: string, fetchImpl: typeof fetch): Promise<Record<string, unknown> | null> {
  const response = await fetchImpl(url, { headers: HEADERS });
  if (!response.ok) return null;
  const data = await response.json();
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

function fromBasic(ticker: string, data: Record<string, unknown>): LiveQuote | null {
  const lastPrice = asNumber(data.closePrice);
  const changePct = asNumber(data.fluctuationsRatio);
  const volume =
    asNumber(data.accumulatedTradingVolume) ??
    asNumber(data.accQuant) ??
    asNumber((data.overMarketPriceInfo as Record<string, unknown> | undefined)?.accumulatedTradingVolume) ??
    0;
  if (!(lastPrice && lastPrice > 0) || changePct == null) return null;
  return { ticker, lastPrice, changePct, volume };
}

function fromSummary(ticker: string, data: Record<string, unknown>): LiveQuote | null {
  const lastPrice = asNumber(data.now) ?? asNumber(data.closePrice);
  const changePct = asNumber(data.rate) ?? asNumber(data.fluctuationsRatio);
  const volume = asNumber(data.quant) ?? asNumber(data.volume) ?? 0;
  if (!(lastPrice && lastPrice > 0) || changePct == null) return null;
  return { ticker, lastPrice, changePct, volume };
}

async function oneTicker(ticker: string, fetchImpl: typeof fetch): Promise<LiveQuote | null> {
  const basic = await jsonGet(`https://m.stock.naver.com/api/stock/${ticker}/basic`, fetchImpl);
  const fromMobile = basic ? fromBasic(ticker, basic) : null;
  if (fromMobile) return fromMobile;
  const summary = await jsonGet(
    `https://api.finance.naver.com/service/itemSummary.nhn?itemcode=${ticker}`,
    fetchImpl,
  );
  return summary ? fromSummary(ticker, summary) : null;
}

async function indexChange(code: "KOSPI" | "KOSDAQ", fetchImpl: typeof fetch): Promise<number | null> {
  const data = await jsonGet(`https://m.stock.naver.com/api/index/${code}/basic`, fetchImpl);
  return asNumber(data?.fluctuationsRatio);
}

export function createNaverProvider(fetchImpl: typeof fetch = fetch): QuoteProvider {
  return {
    name: "naver",
    async quotes(tickers) {
      const rows = await mapPool(tickers, 3, (ticker) => oneTicker(ticker, fetchImpl));
      return rows.filter((row): row is LiveQuote => Boolean(row));
    },
    async indexes(): Promise<IndexMove> {
      const [kospi, kosdaq] = await Promise.all([
        indexChange("KOSPI", fetchImpl),
        indexChange("KOSDAQ", fetchImpl),
      ]);
      return { kospi, kosdaq };
    },
  };
}
