import { describe, expect, it } from "vitest";
import { FIRETREE_DATE, FIRETREE_ID, seedFireTreeGarden } from "./firetree-seed";
import { quoteRecord } from "./quotes";
import type { StoredGarden } from "./types";

const fire = { open: 90, high: 120, low: 80, close: 118, yearHigh: 120, yearLow: 70 };
const noFire = { ...fire, high: 100 };
const position = (ticker: string, gardenId: string) => ({
  id: `${gardenId}_${ticker}`, gardenId, ticker, name: ticker, sector: "반도체",
  quantity: 10, avgCost: 100, purchasedAt: "2026-01-02", plotIndex: 7,
});

describe("seedFireTreeGarden", () => {
  it("collects distinct burning trees with exact first-session seed costs", () => {
    const gardens: StoredGarden[] = [
      { id: "mine", name: "내 정원", positions: [position("000001", "mine"), position("000002", "mine")] },
      { id: "vc_test_01", name: "다른 정원", positions: [position("000001", "vc_test_01"), position("000003", "vc_test_01")] },
    ];
    const result = seedFireTreeGarden(gardens, {
      "000001": { range: fire, yearFirstDate: "2026-01-02", yearFirstClose: 250 }, "000002": { range: noFire }, "000003": { range: fire, yearFirstDate: "2026-01-02", yearFirstClose: 500 },
    });
    expect(result.id).toBe(FIRETREE_ID);
    expect(result.name).toBe("파이어트리");
    expect(result.positions.map((p) => p.ticker)).toEqual(["000001", "000003"]);
    expect(result.positions.map((p) => p.plotIndex)).toEqual([0, 1]);
    expect(result.positions.every((p) => p.purchasedAt === FIRETREE_DATE && p.gardenId === FIRETREE_ID)).toBe(true);
    expect(result.positions[0]).toMatchObject({ quantity: 40000, avgCost: 250 });
    expect(gardens[0].positions[0].purchasedAt).toBe("2026-01-02");
  });
  it("does not label old cost as first-session cost when the seed is unavailable", () => {
    const garden: StoredGarden = { id: "mine", name: "내 정원", positions: [position("000001", "mine")] };
    expect(seedFireTreeGarden([garden], { "000001": { range: fire, yearFirstDate: "2026-01-05", yearFirstClose: 250 } }).positions).toEqual([]);
  });
  it("never treats PCL's 2025 candle as a current fire", () => {
    const quotes = quoteRecord();
    expect(quotes["241820"]?.range).toBeUndefined();
    const garden: StoredGarden = { id: "mine", name: "내 정원", positions: [position("241820", "mine")] };
    expect(seedFireTreeGarden([garden]).positions).toEqual([]);
  });
  it("exposes exact seed fields from generated quotes for real firetree seeding", () => {
    expect(quoteRecord()["159010"]).toMatchObject({ yearFirstDate: "2026-01-02", yearFirstClose: 5110 });
  });
});
