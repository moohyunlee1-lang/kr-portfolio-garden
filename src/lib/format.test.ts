import { describe, expect, it } from "vitest";
import { formatMarketCap, formatMultiple, formatWonOrDash } from "./format";

describe("formatMarketCap", () => {
  it("uses 조원 for trillion-scale caps", () => {
    expect(formatMarketCap(1_578_495_224_000_000)).toBe("1578조원");
  });

  it("uses 억원 below one 조", () => {
    expect(formatMarketCap(3_250_000_000)).toBe("32.5억원");
  });

  it("dashes missing values", () => {
    expect(formatMarketCap(null)).toBe("—");
    expect(formatMultiple(undefined)).toBe("—");
    expect(formatWonOrDash(null)).toBe("—");
  });
});

describe("formatMultiple", () => {
  it("keeps two decimals", () => {
    expect(formatMultiple(12.11)).toBe("12.11배");
  });
});
