import { describe, expect, it } from "vitest";
import {
  MIN_VISUAL_SCALE,
  fruitSaturation,
  fruitTone,
  growthStage,
  holdingDays,
  marketValue,
  plantIntoGarden,
  pnlPct,
  debtPerShare,
  readLastGardenId,
  sizeScale,
  unrealizedPnlAmt,
  weatherFromKospi,
  writeLastGardenId,
  type Garden,
  type PlantInput,
} from "./garden-math";

const NOW = new Date(2026, 8, 28);

function position(
  overrides: Partial<Garden["positions"][number]> = {},
): Garden["positions"][number] {
  return {
    id: "pos-1",
    gardenId: "g1",
    ticker: "005930",
    name: "삼성전자",
    sector: "반도체",
    quantity: 12,
    avgCost: 55000,
    purchasedAt: "2024-01-10",
    lastPrice: 82500,
    changePct: 1.2,
    volume: 1000,
    marketValue: 990000,
    unrealizedPnlPct: 50,
    unrealizedPnlAmt: 330000,
    weightPct: 100,
    holdingDays: 992,
    plotIndex: 0,
    ...overrides,
  };
}

function garden(positions: Garden["positions"] = [position()]): Garden {
  return { id: "g1", name: "테스트 정원", positions };
}

function plant(overrides: Partial<PlantInput> = {}): PlantInput {
  return {
    ticker: "000660",
    name: "SK하이닉스",
    sector: "반도체",
    quantity: 4,
    avgCost: 150000,
    purchasedAt: "2024-06-01",
    plotIndex: 1,
    lastPrice: 180000,
    changePct: -0.4,
    volume: 2000,
    id: "pos-hynix",
    ...overrides,
  };
}

describe("pnlPct", () => {
  it("is (lastPrice - avgCost) / avgCost * 100", () => {
    expect(pnlPct(82500, 55000)).toBe(50);
    expect(pnlPct(180000, 150000)).toBe(20);
    expect(pnlPct(92000, 100000)).toBe(-8);
    expect(pnlPct(100, 100)).toBe(0);
  });

  it("does not divide by zero", () => {
    expect(pnlPct(100, 0)).toBe(0);
  });
});

describe("marketValue", () => {
  it("is quantity times last price", () => {
    expect(marketValue(12, 82500)).toBe(990000);
    expect(marketValue(4, 180000)).toBe(720000);
    expect(marketValue(3, 92000)).toBe(276000);
    expect(marketValue(0, 82500)).toBe(0);
  });
});

describe("unrealizedPnlAmt", () => {
  it("is market value minus cost", () => {
    expect(unrealizedPnlAmt(12, 55000, 82500)).toBe(330000);
    expect(unrealizedPnlAmt(3, 100000, 92000)).toBe(-24000);
  });
});

describe("holdingDays", () => {
  it("counts calendar days and does not shrink below zero", () => {
    expect(holdingDays("2026-09-28", NOW)).toBe(0);
    expect(holdingDays("2026-07-01", NOW)).toBe(89);
    expect(holdingDays("2026-06-30", NOW)).toBe(90);
    expect(holdingDays("2026-10-01", NOW)).toBe(0);
  });
});

describe("growthStage", () => {
  it("uses pnl and holding days, not market value", () => {
    expect(growthStage(-0.01, 89)).toBe("seed");
    expect(growthStage(-10, 0)).toBe("seed");
    expect(growthStage(-0.01, 90)).toBe("sprout");
    expect(growthStage(-8, 941)).toBe("sprout");
    expect(growthStage(0, 1)).toBe("sapling");
    expect(growthStage(9.99, 10)).toBe("sapling");
    expect(growthStage(10, 10)).toBe("tree");
    expect(growthStage(39.99, 400)).toBe("tree");
    expect(growthStage(40, 10)).toBe("lush");
    expect(growthStage(50, 992)).toBe("lush");
  });

  it("promotes a losing position to sapling when dividends have accrued or been confirmed", () => {
    expect(growthStage(-8, 10, { accruedHint: true })).toBe("sapling");
    expect(growthStage(-8, 200, { isConfirmed: true })).toBe("sapling");
    expect(growthStage(-8, 10, { accruedHint: false, isConfirmed: false })).toBe(
      "seed",
    );
    expect(growthStage(50, 10, { accruedHint: true })).toBe("lush");
  });
});

describe("sizeScale", () => {
  it("scales against the largest market value in the garden and keeps a floor", () => {
    expect(sizeScale(990000, 990000)).toBe(1);
    expect(sizeScale(0, 990000)).toBe(MIN_VISUAL_SCALE);
    expect(sizeScale(100, 0)).toBe(MIN_VISUAL_SCALE);
    expect(sizeScale(720000, 990000)).toBeCloseTo(0.8309090909090909);
    expect(sizeScale(276000, 990000)).toBeCloseTo(0.5528484848484849);
    expect(sizeScale(276000, 990000)).toBeLessThan(sizeScale(720000, 990000));
    expect(sizeScale(1, 100)).toBeGreaterThanOrEqual(MIN_VISUAL_SCALE);
    expect(sizeScale(100, 100)).toBeLessThanOrEqual(1);
  });

  it("does not collapse stage and size into one number", () => {
    const lushSmall = {
      stage: growthStage(50, 200),
      scale: sizeScale(100000, 900000),
    };
    const treeLarge = {
      stage: growthStage(20, 200),
      scale: sizeScale(900000, 900000),
    };
    expect(lushSmall.stage).toBe("lush");
    expect(treeLarge.stage).toBe("tree");
    expect(lushSmall.scale).toBeLessThan(treeLarge.scale);
  });
});

describe("plantIntoGarden", () => {
  it("adds a new ticker as its own plot", () => {
    const before = garden();
    const result = plantIntoGarden(before, plant(), NOW);
    expect(result.merged).toBe(false);
    expect(result.garden.positions).toHaveLength(2);
    expect(before.positions).toHaveLength(1);
    expect(result.garden.positions[1]).toMatchObject({
      ticker: "000660",
      quantity: 4,
      avgCost: 150000,
      marketValue: 720000,
      unrealizedPnlPct: 20,
    });
  });

  it("merges the same ticker in one garden: summed quantity, weighted average cost, earlier purchase date", () => {
    const before = garden();
    const result = plantIntoGarden(
      before,
      plant({
        ticker: "005930",
        name: "삼성전자",
        quantity: 8,
        avgCost: 70000,
        purchasedAt: "2025-06-01",
        plotIndex: 7,
        lastPrice: 82500,
        id: "should-not-be-used",
      }),
      NOW,
    );

    expect(result.merged).toBe(true);
    expect(result.garden.positions).toHaveLength(1);
    expect(result.garden.positions[0]).toMatchObject({
      id: "pos-1",
      plotIndex: 0,
      ticker: "005930",
      quantity: 20,
      avgCost: 61000,
      purchasedAt: "2024-01-10",
    });
    expect(before.positions[0].quantity).toBe(12);
    expect(before.positions[0].avgCost).toBe(55000);
  });

  it("keeps the earlier date even when the new lot was bought first", () => {
    const result = plantIntoGarden(
      garden([position({ purchasedAt: "2025-06-01" })]),
      plant({
        ticker: "005930",
        name: "삼성전자",
        quantity: 1,
        avgCost: 50000,
        purchasedAt: "2023-02-01",
        lastPrice: 82500,
      }),
      NOW,
    );
    expect(result.garden.positions[0].purchasedAt).toBe("2023-02-01");
    expect(result.garden.positions[0].holdingDays).toBe(
      holdingDays("2023-02-01", NOW),
    );
  });

  it("allows the same ticker in a different garden", () => {
    const other = plantIntoGarden(
      { id: "g2", name: "다른 정원", positions: [] },
      plant({
        ticker: "005930",
        name: "삼성전자",
        sector: "반도체",
        quantity: 1,
        avgCost: 80000,
        lastPrice: 82500,
      }),
      NOW,
    );
    expect(other.merged).toBe(false);
    expect(other.garden.positions).toHaveLength(1);
    expect(other.garden.positions[0].gardenId).toBe("g2");
  });

  it("recomputes weights so they stay consistent with market value", () => {
    const result = plantIntoGarden(garden(), plant(), NOW);
    const weights = result.garden.positions.map((item) => item.weightPct);
    expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100);
    const samsung = result.garden.positions.find((item) => item.ticker === "005930");
    expect(samsung?.weightPct).toBeCloseTo((990000 / (990000 + 720000)) * 100);
  });

  it("rejects a non-positive quantity", () => {
    expect(() => plantIntoGarden(garden(), plant({ quantity: 0 }), NOW)).toThrow(
      /수량/,
    );
  });
});

describe("fruitTone and fruitSaturation", () => {
  const expected = {
    expectedDate: "2027-12-15",
    isConfirmed: false,
    lastAmount: 1400,
    yieldPct: 4.2,
    accruedHint: true,
  };
  const confirmed = {
    expectedDate: "2027-11-01",
    confirmedDate: "2027-11-20",
    isConfirmed: true,
    lastAmount: 1446,
    yieldPct: 1.8,
    accruedHint: true,
  };

  it("keeps expected fruit muted and confirmed fruit vivid", () => {
    expect(fruitTone(expected)).toBe("muted");
    expect(fruitTone(confirmed)).toBe("vivid");
    expect(fruitTone(undefined)).toBe("none");
    expect(fruitSaturation(expected)).toBeGreaterThan(0);
    expect(fruitSaturation(expected)).toBeLessThan(0.6);
    expect(fruitSaturation(confirmed)).toBeGreaterThanOrEqual(0.9);
    expect(fruitSaturation(confirmed)).toBeGreaterThan(fruitSaturation(expected));
    expect(fruitSaturation(undefined)).toBe(0);
  });

  it("removes fruit after harvest", () => {
    expect(fruitTone(confirmed, true)).toBe("none");
    expect(fruitSaturation(expected, true)).toBe(0);
  });
});

describe("weatherFromKospi", () => {
  it("maps the last session to one sky for every garden", () => {
    expect(weatherFromKospi(1)).toEqual({ regime: "bull", kospiReturn1d: 1 });
    expect(weatherFromKospi(2)).toMatchObject({ regime: "bull" });
    expect(weatherFromKospi(0.99).regime).toBe("neutral");
    expect(weatherFromKospi(0).regime).toBe("neutral");
    expect(weatherFromKospi(-0.99).regime).toBe("neutral");
    expect(weatherFromKospi(-1)).toEqual({
      regime: "bear",
      kospiReturn1d: -1,
    });
  });
});

describe("lastGardenId", () => {
  it("reads and writes the last garden id", () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saved.set(key, value);
      },
    };
    expect(readLastGardenId(storage)).toBeNull();
    writeLastGardenId(storage, "garden-a");
    expect(readLastGardenId(storage)).toBe("garden-a");
    writeLastGardenId(storage, "garden-b");
    expect(readLastGardenId(storage)).toBe("garden-b");
    expect(saved.size).toBe(1);
  });
});

describe("sample garden criteria", () => {
  it("shows three different stages and sizes, with a small dividend sapling", () => {
    const rows = [
      { ticker: "005930", pnl: pnlPct(82500, 55000), mv: marketValue(12, 82500), days: 992, dividend: { isConfirmed: true, accruedHint: true } },
      { ticker: "000660", pnl: pnlPct(180000, 150000), mv: marketValue(4, 180000), days: 800, dividend: undefined },
      { ticker: "033780", pnl: pnlPct(92000, 100000), mv: marketValue(3, 92000), days: 941, dividend: { accruedHint: true, isConfirmed: false } },
    ];
    const max = Math.max(...rows.map((row) => row.mv));
    const viewed = rows.map((row) => ({
      ticker: row.ticker,
      stage: growthStage(row.pnl, row.days, row.dividend),
      scale: sizeScale(row.mv, max),
      tone: fruitTone(row.dividend),
    }));

    expect(viewed.map((row) => row.stage)).toEqual(["lush", "tree", "sapling"]);
    expect(new Set(viewed.map((row) => row.scale)).size).toBe(3);
    expect(viewed[2].scale).toBeLessThan(viewed[1].scale);
    expect(viewed[2].scale).toBeLessThan(viewed[0].scale);
    expect(viewed[2].tone).toBe("muted");
    expect(fruitSaturation(rows[2].dividend)).toBeLessThan(0.6);
  });
});

describe("debtPerShare", () => {
  it("is BPS * debt ratio / 100", () => {
    expect(debtPerShare(63997, 29.94)).toBeCloseTo(19160.7, 1);
  });

  it("returns null when inputs are missing or invalid", () => {
    expect(debtPerShare(null, 30)).toBeNull();
    expect(debtPerShare(1000, undefined)).toBeNull();
    expect(debtPerShare(0, 20)).toBeNull();
    expect(debtPerShare(1000, -1)).toBeNull();
  });
});
