import { describe, expect, it } from "vitest";
import { classifyRangeEffect, intensityFromGap, rangeFromMonths } from "./range-effects";

describe("intensityFromGap", () => {
  it("is strongest near 0% and drops every 10%", () => {
    expect(intensityFromGap(0)).toBe(1);
    expect(intensityFromGap(9.9)).toBe(1);
    expect(intensityFromGap(10)).toBeCloseTo(0.8);
    expect(intensityFromGap(30)).toBeCloseTo(0.4);
  });
});

describe("classifyRangeEffect", () => {
  const base = {
    open: 100,
    high: 120,
    low: 90,
    close: 118,
    yearHigh: 120,
    yearLow: 50,
  };

  it("lights orange fire at the 12-month high when the month is bullish", () => {
    expect(classifyRangeEffect(base)).toMatchObject({ kind: "fire", fireColor: "orange", intensity: 1 });
  });

  it("uses blue fire when monthly open is above close", () => {
    expect(classifyRangeEffect({ ...base, open: 119, close: 118 })).toMatchObject({
      kind: "fire",
      fireColor: "blue",
    });
  });

  it("adds a dark aura at the 12-month low", () => {
    expect(
      classifyRangeEffect({
        open: 52,
        high: 60,
        low: 50,
        close: 51,
        yearHigh: 200,
        yearLow: 50,
      }),
    ).toMatchObject({ kind: "aura" });
  });

  it("is idle off the extremes", () => {
    expect(
      classifyRangeEffect({
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        yearHigh: 200,
        yearLow: 40,
      }).kind,
    ).toBe("none");
  });
});

describe("rangeFromMonths", () => {
  it("takes the latest month and 12-month high/low", () => {
    const range = rangeFromMonths([
      { open: 80, high: 90, low: 70, close: 85 },
      { open: 100, high: 140, low: 95, close: 130 },
    ]);
    expect(range).toMatchObject({ open: 100, high: 140, low: 95, close: 130, yearHigh: 140, yearLow: 70 });
  });
});
