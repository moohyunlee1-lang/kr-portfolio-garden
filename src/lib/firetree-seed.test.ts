import { describe, expect, it } from "vitest";
import { FIRETREE_DATE, FIRETREE_ID, seedFireTreeGarden } from "./firetree-seed";
import type { StoredGarden } from "./types";

const fire = { open: 90, high: 120, low: 80, close: 118, yearHigh: 120, yearLow: 70 };
const noFire = { ...fire, high: 100 };
const position = (ticker: string, gardenId: string) => ({
  id: `${gardenId}_${ticker}`, gardenId, ticker, name: ticker, sector: "반도체",
  quantity: 10, avgCost: 100, purchasedAt: "2026-01-02", plotIndex: 7,
});

describe("seedFireTreeGarden", () => {
  it("collects distinct burning trees from all gardens, retaining the first holding and October 1 date", () => {
    const gardens: StoredGarden[] = [
      { id: "mine", name: "내 정원", positions: [position("000001", "mine"), position("000002", "mine")] },
      { id: "vc_test_01", name: "다른 정원", positions: [position("000001", "vc_test_01"), position("000003", "vc_test_01")] },
    ];
    const result = seedFireTreeGarden(gardens, {
      "000001": { range: fire }, "000002": { range: noFire }, "000003": { range: fire },
    });
    expect(result.id).toBe(FIRETREE_ID);
    expect(result.name).toBe("파이어트리");
    expect(result.positions.map((p) => p.ticker)).toEqual(["000001", "000003"]);
    expect(result.positions.map((p) => p.plotIndex)).toEqual([0, 1]);
    expect(result.positions.every((p) => p.purchasedAt === FIRETREE_DATE && p.gardenId === FIRETREE_ID)).toBe(true);
    expect(result.positions[0].quantity).toBe(10);
    expect(gardens[0].positions[0].purchasedAt).toBe("2026-01-02");
  });
});
