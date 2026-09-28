import type { RangeCandle } from "./types";

export type { RangeCandle } from "./types";
export type RangeEffectKind = "fire" | "aura" | "none";
export type FireColor = "orange" | "blue";

export type RangeEffect = {
  kind: RangeEffectKind;
  fireColor: FireColor;
  intensity: number;
};

/**
 * 월봉 초안. 숫자만 여기서 바꾼다.
 * 최근 월 고가가 12개월 최고면 불, 최근 월 저가가 12개월 최저면 다크 아우라.
 * 고가-종가(또는 종가-저가) 괴리가 0%에 가까울수록 강하고, 10%마다 한 단계 약해진다.
 * 시가 > 종가면 파란 불.
 */
export const RANGE_EFFECT_RULES = {
  stepPct: 10,
  intensityDropPerStep: 0.2,
  minIntensity: 0.15,
} as const;

export function classifyRangeEffect(candle?: RangeCandle | null): RangeEffect {
  if (!candle || !valid(candle)) {
    return { kind: "none", fireColor: "orange", intensity: 0 };
  }
  const atHigh = candle.high >= candle.yearHigh;
  const atLow = candle.low <= candle.yearLow;
  const bearish = candle.open > candle.close;
  if (atHigh && (!atLow || highGapPct(candle) <= lowGapPct(candle))) {
    return {
      kind: "fire",
      fireColor: bearish ? "blue" : "orange",
      intensity: intensityFromGap(highGapPct(candle)),
    };
  }
  if (atLow) {
    return {
      kind: "aura",
      fireColor: "orange",
      intensity: intensityFromGap(lowGapPct(candle)),
    };
  }
  return { kind: "none", fireColor: "orange", intensity: 0 };
}

export function intensityFromGap(gapPct: number): number {
  if (!Number.isFinite(gapPct) || gapPct < 0) return RANGE_EFFECT_RULES.minIntensity;
  const steps = Math.floor(gapPct / RANGE_EFFECT_RULES.stepPct);
  return Math.max(
    RANGE_EFFECT_RULES.minIntensity,
    1 - steps * RANGE_EFFECT_RULES.intensityDropPerStep,
  );
}

export function rangeFromMonths(
  months: Array<{ open: number; high: number; low: number; close: number }>,
): RangeCandle | null {
  if (!months.length) return null;
  const latest = months[months.length - 1];
  const yearHigh = Math.max(...months.map((row) => row.high));
  const yearLow = Math.min(...months.map((row) => row.low));
  if (![latest.open, latest.high, latest.low, latest.close, yearHigh, yearLow].every(finitePositive)) {
    return null;
  }
  return {
    open: latest.open,
    high: latest.high,
    low: latest.low,
    close: latest.close,
    yearHigh,
    yearLow,
  };
}

function highGapPct(candle: RangeCandle): number {
  if (!(candle.high > 0)) return 100;
  return ((candle.high - candle.close) / candle.high) * 100;
}

function lowGapPct(candle: RangeCandle): number {
  if (!(candle.low > 0)) return 100;
  return ((candle.close - candle.low) / candle.low) * 100;
}

function valid(candle: RangeCandle): boolean {
  return [candle.open, candle.high, candle.low, candle.close, candle.yearHigh, candle.yearLow].every(
    finitePositive,
  );
}

function finitePositive(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
