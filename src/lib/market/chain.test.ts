import { describe, expect, it } from "vitest";
import { applyLiveQuotes, fillIndexes, fillQuotes, parseTickerQuery } from "./chain";
import type { QuoteProvider } from "./types";

function provider(
  name: QuoteProvider["name"],
  quotes: Array<{ ticker: string; lastPrice: number; changePct: number; volume: number }>,
  indexes: { kospi: number | null; kosdaq: number | null } = { kospi: null, kosdaq: null },
): QuoteProvider {
  return {
    name,
    async quotes(tickers) {
      return quotes.filter((row) => tickers.includes(row.ticker));
    },
    async indexes() {
      return indexes;
    },
  };
}

describe("fillQuotes", () => {
  it("walks KIS then Yahoo then pykrx then Naver and keeps the first hit", async () => {
    const result = await fillQuotes(["005930", "000660", "035420", "066570"], [
      provider("kis", [{ ticker: "005930", lastPrice: 1, changePct: 1, volume: 10 }]),
      provider("yahoo", [{ ticker: "000660", lastPrice: 2, changePct: 2, volume: 20 }]),
      provider("pykrx", [{ ticker: "035420", lastPrice: 3, changePct: 3, volume: 30 }]),
      provider("naver", [
        { ticker: "066570", lastPrice: 4, changePct: 4, volume: 40 },
        { ticker: "005930", lastPrice: 99, changePct: 9, volume: 9 },
      ]),
    ]);
    expect(result.quotes.map((row) => row.ticker)).toEqual(["005930", "000660", "035420", "066570"]);
    expect(result.quotes[0]?.lastPrice).toBe(1);
    expect(result.source).toEqual({
      "005930": "kis",
      "000660": "yahoo",
      "035420": "pykrx",
      "066570": "naver",
    });
  });

  it("skips a provider that throws", async () => {
    const broken: QuoteProvider = {
      name: "kis",
      async quotes() {
        throw new Error("down");
      },
      async indexes() {
        throw new Error("down");
      },
    };
    const result = await fillQuotes(["005930"], [
      broken,
      provider("yahoo", [{ ticker: "005930", lastPrice: 270000, changePct: 0, volume: 1 }]),
    ]);
    expect(result.source["005930"]).toBe("yahoo");
  });
});

describe("fillIndexes", () => {
  it("fills missing legs from later providers", async () => {
    const result = await fillIndexes([
      provider("kis", [], { kospi: 1.2, kosdaq: null }),
      provider("yahoo", [], { kospi: 9, kosdaq: -0.4 }),
    ]);
    expect(result.kospi).toBe(1.2);
    expect(result.kosdaq).toBe(-0.4);
    expect(result.source).toEqual({ kospi: "kis", kosdaq: "yahoo" });
  });
});

describe("parseTickerQuery", () => {
  it("keeps unique 6-digit codes up to the limit", () => {
    expect(parseTickerQuery("005930,000660,005930,nope", 2)).toEqual(["005930", "000660"]);
  });

  it("accepts new 6-character KRX short codes", () => {
    expect(parseTickerQuery("0126Z0,0120G0,bad")).toEqual(["0126Z0", "0120G0"]);
  });
});

describe("applyLiveQuotes", () => {
  it("overwrites price fields and leaves the rest", () => {
    const next = applyLiveQuotes(
      {
        "005930": {
          ticker: "005930",
          name: "삼성전자",
          sector: "반도체",
          lastPrice: 80000,
          changePct: 1,
          volume: 1,
          fundamentals: { per: 12 },
        },
      },
      [{ ticker: "005930", lastPrice: 270000, changePct: -0.5, volume: 99 }],
    );
    expect(next["005930"]?.lastPrice).toBe(270000);
    expect(next["005930"]?.changePct).toBe(-0.5);
    expect(next["005930"]?.volume).toBe(99);
    expect(next["005930"]?.fundamentals?.per).toBe(12);
  });
});
