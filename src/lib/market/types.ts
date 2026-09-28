export type ProviderName = "kis" | "yahoo" | "pykrx" | "naver";

export type LiveQuote = {
  ticker: string;
  lastPrice: number;
  changePct: number;
  volume: number;
};

export type IndexMove = {
  kospi: number | null;
  kosdaq: number | null;
};

export type QuoteProvider = {
  name: ProviderName;
  quotes(tickers: string[]): Promise<LiveQuote[]>;
  indexes(): Promise<IndexMove>;
};

export type QuoteLike = {
  ticker: string;
  name: string;
  sector: string;
  lastPrice: number;
  changePct: number;
  volume: number;
  dividend?: unknown;
  issues?: unknown;
  fundamentals?: unknown;
  range?: unknown;
};
