import { describe, expect, it } from "vitest";
import { cbIssuanceGardens, isGeneratedGarden, mergeCbGardens } from "./cb-issuance-seed";
import { mergeValueChainGardens } from "./valuechain-seed";

describe("cb issuance gardens", () => {
  const gardens = cbIssuanceGardens();

  it("splits markets and ranks KOSDAQ into three amount bands", () => {
    expect(gardens.map((garden) => garden.id)).toEqual([
      "cb_kospi",
      "cb_kosdaq_01",
      "cb_kosdaq_02",
      "cb_kosdaq_03",
      "cb_konex",
    ]);
    expect(gardens.every((garden) => garden.group === "전환사채")).toBe(true);
    expect(gardens.every((garden) => /^[\x00-\x7F]+$/.test(garden.id))).toBe(true);
    expect(gardens.find((garden) => garden.id === "cb_kospi")?.positions.length).toBe(18);
    expect(gardens.find((garden) => garden.id === "cb_kospi")?.positions.map((position) => position.ticker)).toEqual(
      expect.arrayContaining(["011160", "102280"]),
    );
    expect(gardens.filter((garden) => garden.id.startsWith("cb_kosdaq_")).map((garden) => garden.positions.length)).toEqual([
      31, 31, 30,
    ]);
    expect(gardens.find((garden) => garden.id === "cb_konex")?.positions.length).toBe(6);
  });

  it("seeds about 10 million won at the first 2026 close", () => {
    for (const garden of gardens) {
      for (const position of garden.positions) {
        expect(position.quantity * position.avgCost).toBeLessThanOrEqual(10_000_000);
        expect(position.quantity * position.avgCost).toBeGreaterThan(10_000_000 - position.avgCost);
        expect(/^\d{4}-\d{2}-\d{2}$/.test(position.purchasedAt)).toBe(true);
        expect(position.sector).toBe("전환사채");
      }
    }
  });

  it("replaces cb gardens without touching value-chain gardens", () => {
    const once = mergeCbGardens(mergeValueChainGardens([{ id: "mine", name: "내 밭", positions: [] }]));
    const twice = mergeCbGardens(once);
    expect(twice.filter((garden) => garden.id.startsWith("cb_"))).toHaveLength(5);
    expect(twice.filter((garden) => garden.id.startsWith("vc_")).length).toBeGreaterThan(100);
    expect(twice[0].id).toBe("mine");
    expect(isGeneratedGarden("cb_kospi")).toBe(true);
    expect(isGeneratedGarden("vc_semiconductor-sobujang_01")).toBe(true);
    expect(isGeneratedGarden("mine")).toBe(false);
  });
});
