import { describe, expect, it } from "vitest";
import type { Garden, Position } from "./types";
import {
  gardenPeriodReturnPct,
  periodReturnPct,
  RANK_PERIODS,
  rankGardens,
  rankTrees,
} from "./ranks";

function position(overrides: Partial<Position> = {}): Position {
  return {
    id: "pos-1",
    gardenId: "g1",
    ticker: "005930",
    name: "삼성전자",
    sector: "반도체",
    quantity: 10,
    avgCost: 100,
    purchasedAt: "2026-01-02",
    lastPrice: 110,
    changePct: 2,
    volume: 1,
    marketValue: 1100,
    unrealizedPnlPct: 10,
    unrealizedPnlAmt: 100,
    weightPct: 50,
    holdingDays: 1,
    plotIndex: 0,
    ...overrides,
  };
}

function garden(id: string, name: string, positions: Position[]): Garden {
  return { id, name, positions };
}

describe("RANK_PERIODS", () => {
  it("labels the day tab as today's session", () => {
    expect(RANK_PERIODS[0]).toMatchObject({ id: "day", label: "일간", hint: "당일 기준 · 10분마다" });
  });
});

describe("periodReturnPct", () => {
  it("uses daily change for the day period", () => {
    expect(periodReturnPct(position({ changePct: -1.5 }), "day")).toBe(-1.5);
  });

  it("uses daily change for the week period", () => {
    expect(periodReturnPct(position({ changePct: -1.5 }), "week")).toBe(-1.5);
  });

  it("uses the live last price against month open when ranking the month", () => {
    expect(
      periodReturnPct(
        position({
          lastPrice: 130,
          range: { open: 100, high: 120, low: 90, close: 110, yearHigh: 120, yearLow: 80 },
        }),
        "month",
      ),
    ).toBe(30);
  });

  it("returns null when the month candle is missing", () => {
    expect(periodReturnPct(position({ range: undefined }), "month")).toBeNull();
  });

  it("uses cost to last price for the year period", () => {
    expect(periodReturnPct(position({ lastPrice: 80, avgCost: 100 }), "year")).toBe(-20);
  });
});

describe("gardenPeriodReturnPct", () => {
  it("value-weights daily changes for the day", () => {
    const rows = [
      position({ id: "a", lastPrice: 110, quantity: 10, changePct: 2, marketValue: 1100 }),
      position({ id: "b", lastPrice: 80, quantity: 10, changePct: -10, marketValue: 800 }),
    ];
    expect(gardenPeriodReturnPct(rows, "day")).toBeCloseTo((1100 * 2 + 800 * -10) / 1900);
  });

  it("value-weights daily changes for the week", () => {
    const rows = [
      position({ id: "a", lastPrice: 110, quantity: 10, changePct: 2, marketValue: 1100 }),
      position({ id: "b", lastPrice: 80, quantity: 10, changePct: -10, marketValue: 800 }),
    ];
    expect(gardenPeriodReturnPct(rows, "week")).toBeCloseTo((1100 * 2 + 800 * -10) / 1900);
  });

  it("cost-weights holding returns for the year", () => {
    const rows = [
      position({ id: "a", quantity: 10, avgCost: 100, lastPrice: 110, unrealizedPnlAmt: 100 }),
      position({ id: "b", quantity: 10, avgCost: 100, lastPrice: 80, unrealizedPnlAmt: -200 }),
    ];
    expect(gardenPeriodReturnPct(rows, "year")).toBeCloseTo(-5);
  });

  it("skips trees without a month candle", () => {
    const rows = [
      position({
        id: "a",
        quantity: 1,
        lastPrice: 120,
        range: { open: 100, high: 110, low: 90, close: 110, yearHigh: 120, yearLow: 80 },
      }),
      position({ id: "b", quantity: 99, range: undefined }),
    ];
    expect(gardenPeriodReturnPct(rows, "month")).toBe(20);
  });

  it("returns null for an empty garden", () => {
    expect(gardenPeriodReturnPct([], "week")).toBeNull();
  });
});

describe("rankGardens", () => {
  it("orders gardens by period return and keeps ties", () => {
    const ranked = rankGardens(
      [
        garden("g-low", "낮은 밭", [position({ id: "l", changePct: 1, lastPrice: 100, quantity: 1, marketValue: 100 })]),
        garden("g-high", "높은 밭", [position({ id: "h", changePct: 5, lastPrice: 100, quantity: 1, marketValue: 100 })]),
        garden("g-tie", "같은 밭", [position({ id: "t", changePct: 5, lastPrice: 100, quantity: 1, marketValue: 100 })]),
        garden("g-empty", "빈 밭", []),
      ],
      "week",
    );
    expect(ranked.map((row) => ({ id: row.id, rank: row.rank, returnPct: row.returnPct }))).toEqual([
      { id: "g-tie", rank: 1, returnPct: 5 },
      { id: "g-high", rank: 1, returnPct: 5 },
      { id: "g-low", rank: 3, returnPct: 1 },
    ]);
  });
});

describe("rankTrees", () => {
  it("ranks trees across gardens and keeps garden plus plant ids", () => {
    const ranked = rankTrees(
      [
        garden("g1", "반도체 밭", [
          position({ id: "pos-a", name: "삼성전자", ticker: "005930", changePct: 3 }),
        ]),
        garden("g2", "자동차 밭", [
          position({
            id: "pos-b",
            gardenId: "g2",
            name: "현대차",
            ticker: "005380",
            changePct: 8,
          }),
        ]),
      ],
      "week",
    );
    expect(ranked[0]).toMatchObject({
      rank: 1,
      gardenId: "g2",
      gardenName: "자동차 밭",
      positionId: "pos-b",
      name: "현대차",
      returnPct: 8,
    });
    expect(ranked[1]).toMatchObject({
      rank: 2,
      gardenId: "g1",
      positionId: "pos-a",
      returnPct: 3,
    });
  });

  it("ranks the day tab only after a live quote overlay", () => {
    const gardens = [
      garden("g1", "반도체 밭", [
        position({ id: "pos-a", name: "삼성전자", ticker: "005930", changePct: -5.76 }),
      ]),
      garden("g2", "자동차 밭", [
        position({
          id: "pos-b",
          gardenId: "g2",
          name: "현대차",
          ticker: "005380",
          changePct: 8,
        }),
      ]),
    ];
    expect(rankTrees(gardens, "day", new Set())).toEqual([]);
    const ranked = rankTrees(gardens, "day", new Set(["005930"]));
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ ticker: "005930", returnPct: -5.76 });
  });
});
