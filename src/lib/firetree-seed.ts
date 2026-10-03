import { classifyRangeEffect } from "./range-effects";
import { quoteRecord } from "./quotes";
import type { StoredGarden, StoredPosition } from "./types";

export const FIRETREE_ID = "garden_firetree_20261001";
export const FIRETREE_DATE = "2026-10-01";

/** A one-time snapshot of distinct burning tickers in the user's visible gardens. */
export function seedFireTreeGarden(
  gardens: StoredGarden[],
  ranges: Record<string, { range?: Parameters<typeof classifyRangeEffect>[0] }> = quoteRecord(),
): StoredGarden {
  const positions: StoredPosition[] = [];
  const seen = new Set<string>();
  for (const garden of gardens) {
    if (garden.id === FIRETREE_ID) continue;
    for (const position of garden.positions) {
      if (seen.has(position.ticker)) continue;
      if (classifyRangeEffect(ranges[position.ticker]?.range).kind !== "fire") continue;
      seen.add(position.ticker);
      positions.push({
        ...position,
        id: `firetree_${position.ticker}`,
        gardenId: FIRETREE_ID,
        plotIndex: positions.length,
        purchasedAt: FIRETREE_DATE,
      });
    }
  }
  return { id: FIRETREE_ID, name: "파이어트리", positions };
}
