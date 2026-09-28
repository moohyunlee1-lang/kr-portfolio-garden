import { describe, expect, it } from "vitest";
import { layoutFor } from "./plots";
import { mergeValueChainGardens, valueChainGardens } from "./valuechain-seed";
import { quoteRecord } from "./quotes";

describe("value-chain gardens", () => {
  const gardens = valueChainGardens();

  it("makes one garden per primary value chain in the 9 sectors", () => {
    expect(gardens).toHaveLength(131);
    const groups = new Map<string, number>();
    for (const garden of gardens) {
      groups.set(garden.group ?? "", (groups.get(garden.group ?? "") ?? 0) + 1);
    }
    expect(groups.get("반도체")).toBe(10);
    expect(groups.get("2차전지")).toBe(18);
    expect(groups.get("바이오")).toBe(19);
    expect(groups.get("로봇")).toBe(13);
    expect(groups.get("조선")).toBe(13);
    expect(groups.get("방산")).toBe(11);
    expect(groups.get("원전")).toBe(12);
    expect(groups.get("자동차")).toBe(22);
    expect(groups.get("화장품")).toBe(13);
  });

  it("plants about 10 million won on 2026-01-02 closes", () => {
    const quotes = quoteRecord();
    const samsung = gardens
      .flatMap((garden) => garden.positions)
      .find((position) => position.ticker === "005930");
    expect(samsung).toBeTruthy();
    expect(samsung?.purchasedAt).toBe("2026-01-02");
    expect(samsung?.avgCost).toBe(128500);
    expect(samsung?.quantity).toBe(77);
    expect(samsung!.quantity * samsung!.avgCost).toBeLessThanOrEqual(10_000_000);
    expect(samsung!.quantity * samsung!.avgCost).toBeGreaterThan(10_000_000 - 128500);
    expect(quotes["005930"]?.lastPrice).toBeGreaterThan(0);

    const planted = gardens.reduce((sum, garden) => sum + garden.positions.length, 0);
    expect(planted).toBe(1881);
  });

  it("replaces generated gardens without duplicating", () => {
    const once = mergeValueChainGardens([]);
    const twice = mergeValueChainGardens(once);
    expect(twice.filter((garden) => garden.id.startsWith("vc_"))).toHaveLength(131);
  });

  it("grows the plot grid instead of capping at 16", () => {
    expect(layoutFor(16).count).toBe(16);
    expect(layoutFor(69).count).toBeGreaterThanOrEqual(69);
    expect(layoutFor(69).cols).toBe(4);
  });
});
