import { describe, expect, it } from "vitest";
import { createYahooProvider } from "./yahoo";

function chartResponse(meta: Record<string, unknown> | null, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    json: async () => ({ chart: { result: meta ? [{ meta }] : [] } }),
  } as Response;
}

describe("yahoo KR quotes", () => {
  it("skips a stale .KS MUTUALFUND chart and uses the .KQ equity tape", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("180400.KS")) {
        return chartResponse({
          instrumentType: "MUTUALFUND",
          regularMarketPrice: 2850,
          regularMarketChangePercent: 29.841,
          regularMarketVolume: 0,
          chartPreviousClose: 2320,
        });
      }
      if (url.includes("180400.KQ")) {
        return chartResponse({
          instrumentType: "EQUITY",
          regularMarketPrice: 2230,
          regularMarketChangePercent: -2.179,
          regularMarketVolume: 1200,
          chartPreviousClose: 2280,
        });
      }
      return chartResponse(null, 404);
    };
    const rows = await createYahooProvider(fetchImpl).quotes(["180400"]);
    expect(rows).toEqual([{ ticker: "180400", lastPrice: 2230, changePct: -2.179, volume: 1200 }]);
  });

  it("still uses a KOSPI .KS equity quote", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("005030.KS")) {
        return chartResponse({
          instrumentType: "EQUITY",
          regularMarketPrice: 51,
          regularMarketChangePercent: 37.838,
          regularMarketVolume: 9000,
        });
      }
      throw new Error(`unexpected ${url}`);
    };
    const rows = await createYahooProvider(fetchImpl).quotes(["005030"]);
    expect(rows[0]).toMatchObject({ ticker: "005030", lastPrice: 51, changePct: 37.838 });
  });
});
