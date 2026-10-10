import { expect, it } from "vitest";
import { buildDashboard, rankedStocks, money, percent } from "./dashboard";
import type { Garden, Position } from "./types";
export const position = (
  ticker: string,
  overrides: Partial<Position> = {},
): Position => ({
  id: ticker,
  gardenId: "g",
  ticker,
  name: ticker,
  sector: "간접 정원",
  quantity: 10,
  avgCost: 100,
  lastPrice: 150,
  purchasedAt: "2026-01-02",
  changePct: 0,
  volume: 0,
  marketValue: 999,
  unrealizedPnlPct: 999,
  unrealizedPnlAmt: 999,
  weightPct: 0,
  holdingDays: 1,
  plotIndex: 0,
  ...overrides,
});
export const garden = (positions: Position[]): Garden => ({
  id: "g",
  name: "나의 밭",
  positions,
});
it("freezes purchase-cost returns and canonical sector market weights from current overlay", () => {
  const input = garden([
    position("A"),
    position("B", { avgCost: 200, lastPrice: 100 }),
  ]);
  const d = buildDashboard(
    input,
    { A: "반도체", B: "자동차" },
    "2026-10-09T00:00:00Z",
  );
  expect(d.marketValue).toBe(2500);
  expect(d.cost).toBe(3000);
  expect(d.profit).toBe(-500);
  expect(d.returnPct).toBeCloseTo(-100 / 6);
  expect(d.sectors[0].name).toBe("반도체");
  expect(d.sectors[0].weightPct).toBe(60);
  expect(d.sectors[0].returnPct).toBe(50);
  input.positions[0].lastPrice = 999;
  expect(d.stocks[0].marketValue).toBe(1500);
});
it("keeps unknown prices unknown and zero cost returns unavailable", () => {
  const d = buildDashboard(
    garden([position("A", { lastPrice: 0 }), position("B", { avgCost: 0 })]),
    {},
    "now",
  );
  expect(d.sectors[0].name).toBe("미분류·검토 필요");
  expect(d.marketValue).toBeNull();
  expect(d.profit).toBeNull();
  expect(d.stocks[0].returnPct).toBeNull();
  expect(d.stocks[1].returnPct).toBeNull();
  expect(d.stocks[1].weightPct).toBeNull();
  expect(buildDashboard(garden([]), {}, "now").returnPct).toBeNull();
  expect(money(null)).toBe("—");
  expect(money(123456789)).toBe("1.23억원");
  expect(percent(null)).toBe("—");
});
it("aggregates duplicate tickers by real cost and avoids overlapping top/bottom", () => {
  const d = buildDashboard(
    garden([position("A"), position("A", { avgCost: 200 })]),
    {},
    "now",
  );
  expect(d.stocks).toHaveLength(1);
  expect(d.stocks[0].cost).toBe(3000);
  const many = buildDashboard(
    garden(
      Array.from({ length: 80 }, (_, i) =>
        position(String(i), { lastPrice: i + 1 }),
      ),
    ),
    {},
    "now",
  );
  const ranks = rankedStocks(many.stocks);
  expect(ranks).toHaveLength(60);
  expect(ranks[30].rank).toBe(51);
  expect(new Set(ranks.map((r) => r.ticker)).size).toBe(60);
  expect(rankedStocks(d.stocks)).toHaveLength(1);
});
