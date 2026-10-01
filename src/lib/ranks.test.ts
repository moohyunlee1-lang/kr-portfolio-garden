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

  it("describes market periods instead of holding cost", () => {
    expect(RANK_PERIODS.slice(1).map((row) => row.hint)).toEqual([
      "이번 주 시가 대비",
      "이번 달 시가 대비",
      "연초 시가 대비",
    ]);
  });
});

describe("periodReturnPct", () => {
  it("uses daily change for the day period", () => {
    expect(periodReturnPct(position({ changePct: -1.5 }), "day")).toBe(-1.5);
  });

  it("uses the market week baseline instead of daily change", () => {
    expect(
      periodReturnPct(
        position({ lastPrice: 120, changePct: -1.5, period: { weekOpen: 100 } }),
        "week",
      ),
    ).toBe(20);
  });

  it("uses the live last price against month open when ranking the month", () => {
    expect(
      periodReturnPct(
        position({
          lastPrice: 130,
          period: { monthOpen: 100 },
        }),
        "month",
      ),
    ).toBe(30);
  });

  it("returns null when the month candle is missing", () => {
    expect(periodReturnPct(position({ period: undefined }), "month")).toBeNull();
  });

  it("uses the market year baseline instead of planted average cost", () => {
    expect(
      periodReturnPct(
        position({ lastPrice: 120, avgCost: 500, period: { yearOpen: 100 } }),
        "year",
      ),
    ).toBe(20);
  });

  it("uses the adjusted monthly baseline for Shaperon", () => {
    expect(
      periodReturnPct(
        position({
          ticker: "378800",
          name: "샤페론",
          lastPrice: 2490,
          avgCost: 510,
          period: { monthOpen: 2550 },
        }),
        "month",
      ),
    ).toBeCloseTo(-2.3529411765);
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

  it("baseline-weights market returns for the week", () => {
    const rows = [
      position({ id: "a", lastPrice: 110, quantity: 10, period: { weekOpen: 100 } }),
      position({ id: "b", lastPrice: 80, quantity: 10, period: { weekOpen: 100 } }),
    ];
    expect(gardenPeriodReturnPct(rows, "week")).toBeCloseTo(-5);
  });

  it("baseline-weights market returns for the year", () => {
    const rows = [
      position({ id: "a", quantity: 10, avgCost: 1, lastPrice: 110, period: { yearOpen: 100 } }),
      position({ id: "b", quantity: 10, avgCost: 999, lastPrice: 80, period: { yearOpen: 100 } }),
    ];
    expect(gardenPeriodReturnPct(rows, "year")).toBeCloseTo(-5);
  });

  it("skips trees without a month candle", () => {
    const rows = [
      position({
        id: "a",
        quantity: 1,
        lastPrice: 120,
        period: { monthOpen: 100 },
      }),
      position({ id: "b", quantity: 99, period: undefined }),
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
        garden("g-low", "낮은 밭", [position({ id: "l", lastPrice: 101, quantity: 1, period: { weekOpen: 100 } })]),
        garden("g-high", "높은 밭", [position({ id: "h", lastPrice: 105, quantity: 1, period: { weekOpen: 100 } })]),
        garden("g-tie", "같은 밭", [position({ id: "t", lastPrice: 105, quantity: 1, period: { weekOpen: 100 } })]),
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
          position({ id: "pos-a", name: "삼성전자", ticker: "005930", lastPrice: 103, period: { weekOpen: 100 } }),
        ]),
        garden("g2", "자동차 밭", [
          position({
            id: "pos-b",
            gardenId: "g2",
            name: "현대차",
            ticker: "005380",
            lastPrice: 108,
            period: { weekOpen: 100 },
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

  it("gives the same ticker the same market return in every garden", () => {
    const ranked = rankTrees(
      [
        garden("wmj1", "WMJ1", [
          position({
            id: "sk-wmj1",
            ticker: "000660",
            name: "SK하이닉스",
            avgCost: 700000,
            lastPrice: 900000,
            period: { yearOpen: 600000 },
          }),
        ]),
        garden("semis", "반도체", [
          position({
            id: "sk-semis",
            ticker: "000660",
            name: "SK하이닉스",
            avgCost: 120000,
            lastPrice: 900000,
            period: { yearOpen: 600000 },
          }),
        ]),
      ],
      "year",
    );

    expect(ranked).toHaveLength(2);
    expect(ranked.map((row) => row.returnPct)).toEqual([50, 50]);
    expect(new Set(ranked.map((row) => row.gardenId))).toEqual(new Set(["wmj1", "semis"]));
  });
});
