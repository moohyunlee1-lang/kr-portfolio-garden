export type CanopySize = "small" | "mid" | "large";
export type EarningsTone = "bright" | "dark";
export type FoliageDensity = "sparse" | "medium" | "dense";

export type TreeTraits = {
  size: CanopySize;
  tone: EarningsTone;
  foliage: FoliageDensity;
  label: string;
};

/**
 * Draft cutoffs. Change numbers here; meshes read traits only.
 * 시가총액: 소목 < 5천억 ≤ 중목 < 2조 ≤ 대목
 * EPS: 음수면 어두운 잎, 그 외 밝은 잎
 * 부채비율: ≤50% 잎 많음, ≤120% 보통, 그 위 잎 적음
 */
export const TREE_TRAIT_RULES = {
  marketCap: {
    largeAt: 2_000_000_000_000,
    midAt: 500_000_000_000,
  },
  debtRatioPct: {
    denseAtOrBelow: 50,
    mediumAtOrBelow: 120,
  },
} as const;

export const SIZE_LABEL: Record<CanopySize, string> = {
  small: "소목",
  mid: "중목",
  large: "대목",
};

export const TONE_LABEL: Record<EarningsTone, string> = {
  bright: "밝은",
  dark: "어두운",
};

export const FOLIAGE_LABEL: Record<FoliageDensity, string> = {
  sparse: "잎 적음",
  medium: "잎 보통",
  dense: "잎 많음",
};

export function classifyTree(input?: {
  marketCap?: number | null;
  eps?: number | null;
  debtRatioPct?: number | null;
} | null): TreeTraits {
  const size = sizeFromCap(input?.marketCap);
  const tone: EarningsTone = typeof input?.eps === "number" && input.eps < 0 ? "dark" : "bright";
  const foliage = foliageFromDebt(input?.debtRatioPct);
  return {
    size,
    tone,
    foliage,
    label: `${SIZE_LABEL[size]} · ${TONE_LABEL[tone]} · ${FOLIAGE_LABEL[foliage]}`,
  };
}

function sizeFromCap(marketCap: number | null | undefined): CanopySize {
  if (!(typeof marketCap === "number") || !Number.isFinite(marketCap) || marketCap <= 0) return "mid";
  if (marketCap >= TREE_TRAIT_RULES.marketCap.largeAt) return "large";
  if (marketCap >= TREE_TRAIT_RULES.marketCap.midAt) return "mid";
  return "small";
}

function foliageFromDebt(debtRatioPct: number | null | undefined): FoliageDensity {
  if (!(typeof debtRatioPct === "number") || !Number.isFinite(debtRatioPct) || debtRatioPct < 0) {
    return "medium";
  }
  if (debtRatioPct <= TREE_TRAIT_RULES.debtRatioPct.denseAtOrBelow) return "dense";
  if (debtRatioPct <= TREE_TRAIT_RULES.debtRatioPct.mediumAtOrBelow) return "medium";
  return "sparse";
}
