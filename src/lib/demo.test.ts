import { describe, expect, it } from "vitest";
import { createSampleGarden } from "./demo";
import {
  fruitSaturation,
  fruitTone,
  growthStage,
  materializeGarden,
  maxMarketValue,
  sizeScale,
} from "./garden-math";
import { quoteRecord } from "./quotes";

describe("sample garden data", () => {
  it("materializes three trees with different stages, sizes, and a muted dividend sapling", () => {
    const quotes = quoteRecord();
    quotes["005930"] = { ...quotes["005930"], lastPrice: 90000 };
    quotes["000660"] = { ...quotes["000660"], lastPrice: 180000 };
    quotes["033780"] = { ...quotes["033780"], lastPrice: 90000 };
    const garden = materializeGarden(
      createSampleGarden("sample"),
      quotes,
      new Date(2026, 8, 28),
    );
    expect(garden.positions).toHaveLength(3);
    expect(garden.positions.map((position) => position.ticker)).toEqual([
      "005930",
      "000660",
      "033780",
    ]);
    expect(garden.positions[0].marketValue).toBe(12 * quotes["005930"].lastPrice);
    expect(garden.positions[1].marketValue).toBe(4 * quotes["000660"].lastPrice);
    expect(garden.positions[2].marketValue).toBe(3 * quotes["033780"].lastPrice);
    expect(garden.positions[2].unrealizedPnlPct).toBeLessThan(0);

    const max = maxMarketValue(garden.positions);
    const viewed = garden.positions.map((position) => ({
      stage: growthStage(
        position.unrealizedPnlPct,
        position.holdingDays,
        position.dividend,
      ),
      scale: sizeScale(position.marketValue, max),
      tone: fruitTone(position.dividend),
    }));

    expect(viewed[0].stage).toBe("lush");
    expect(viewed[2].stage).toBe("sapling");
    expect(viewed[2].scale).toBeLessThan(viewed[0].scale);
    expect(viewed[2].tone).toBe("muted");
    expect(fruitSaturation(garden.positions[2].dividend)).toBeLessThan(0.6);
    expect(fruitTone(garden.positions[0].dividend)).toBe("vivid");
    expect(
      garden.positions.reduce((sum, position) => sum + position.weightPct, 0),
    ).toBeCloseTo(100);
  });
});
