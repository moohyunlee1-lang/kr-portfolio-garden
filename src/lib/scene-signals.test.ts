import { describe, expect, it } from "vitest";
import { sceneScale } from "./scene-signals";
import { sizeScale } from "./garden-math";

describe("garden scene scales", () => {
  const quote = { yearFirstDate: "2026-01-02", yearFirstClose: 100 };
  it("uses first-session performance for each named garden, not market-value ranking", () => {
    for (const id of ["garden_firetree_20261001", "ma_watch", "cross_watch"])
      expect(sceneScale(id, 120, 9999999, 9999999, quote)).toBeCloseTo(1.2);
  });
  it("keeps normal garden market-value sizing", () => {
    expect(sceneScale("mine", 120, 200, 1000, quote)).toBe(sizeScale(200, 1000));
  });
});
