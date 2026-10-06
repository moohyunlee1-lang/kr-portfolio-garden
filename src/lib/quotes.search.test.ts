import { describe, expect, it } from "vitest";
import { getQuote, searchQuotes } from "./quotes";

describe("searchQuotes sectors", () => {
  it("labels Samsung Electronics as 반도체, not 바이오", () => {
    const hits = searchQuotes("삼성전자");
    expect(hits[0]?.ticker).toBe("005930");
    expect(hits[0]?.sector).toBe("반도체");
    expect(getQuote("005930")?.sector).toBe("반도체");
  });

  it("does not put SK hynix, Hyundai Motor, or Kia on a side-chain sector", () => {
    expect(getQuote("000660")?.sector).toBe("반도체");
    expect(getQuote("005380")?.sector).toBe("자동차");
    expect(getQuote("000270")?.sector).toBe("자동차");
    expect(getQuote("006400")?.sector).toBe("2차전지");
    expect(getQuote("012450")?.sector).toBe("방산");
  });

  it("finds KR-Market Brain names outside the nine chain gardens", () => {
    const hits = searchQuotes("카카오뱅크");
    expect(hits[0]?.ticker).toBe("323410");
    expect(getQuote("323410")?.name).toBe("카카오뱅크");
  });
  it("has a baseline for the listed preferred share planted in the risk garden", () => {
    expect(getQuote("032685")?.name).toBe("소프트센우");
    expect(getQuote("032685")?.lastPrice).toBeGreaterThan(0);
  });
});
