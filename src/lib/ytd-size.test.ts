import { describe, expect, it } from "vitest";
import { isYtdGarden, ytdSizeScale } from "./ytd-size";

describe("named garden YTD tree scale", () => {
  it("only applies to the three named gardens", () => {
    expect(["garden_firetree_20261001", "ma_watch", "cross_watch"].every(isYtdGarden)).toBe(true);
    expect(isYtdGarden("vc_test_01")).toBe(false);
  });
  it("uses market price versus exact first-session close, bounded symmetrically", () => {
    const quote = { yearFirstDate: "2026-01-02", yearFirstClose: 100 };
    expect(ytdSizeScale(120, quote)).toBeCloseTo(1.2);
    expect(ytdSizeScale(10, quote)).toBe(0.65);
    expect(ytdSizeScale(1000, quote)).toBe(1.6);
    expect(ytdSizeScale(110, { yearFirstDate: "2026-01-05", yearFirstClose: 100 })).toBe(1);
    expect(ytdSizeScale(110, { yearFirstDate: "2026-01-02", yearFirstClose: 0 })).toBe(1);
    expect(ytdSizeScale(0, quote)).toBe(1);
  });
});
