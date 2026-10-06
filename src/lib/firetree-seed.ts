import { classifyRangeEffect } from "./range-effects";
import { quoteRecord } from "./quotes";
import type { StoredGarden, StoredPosition } from "./types";

export const FIRETREE_ID = "garden_firetree_20261001";
export const FIRETREE_DATE = "2026-01-02";
export const FIRST_SESSION_BUDGET = 10_000_000;
type SeedQuote = { yearFirstDate?: string | null; yearFirstClose?: number | null };
export function firstSessionCost(quote?: SeedQuote): number | null {
  const cost = quote?.yearFirstClose;
  return quote?.yearFirstDate === FIRETREE_DATE && typeof cost === "number" && Number.isFinite(cost) && cost > 0 && cost <= FIRST_SESSION_BUDGET ? cost : null;
}

/** Keep snapshot identity but omit holdings that cannot honestly use the exact YTD seed. */
export function migrateFireTreeGarden(garden: StoredGarden, quotes: Record<string, SeedQuote>): StoredGarden {
  const positions = garden.positions.flatMap((position) => {
    const cost = firstSessionCost(quotes[position.ticker]);
    return cost == null ? [] : [{
      ...position, avgCost: cost, quantity: Math.floor(FIRST_SESSION_BUDGET / cost), purchasedAt: FIRETREE_DATE,
    }];
  }).map((position, plotIndex) => ({ ...position, plotIndex }));
  return { ...garden, name: "파이어트리", positions };
}

/** A one-time snapshot of distinct burning tickers in the user's visible gardens. */
export function seedFireTreeGarden(
  gardens: StoredGarden[],
  ranges: Record<string, SeedQuote & { range?: Parameters<typeof classifyRangeEffect>[0] }> = quoteRecord(),
): StoredGarden {
  const positions: StoredPosition[] = [];
  const seen = new Set<string>();
  for (const garden of gardens) {
    if (garden.id === FIRETREE_ID) continue;
    for (const position of garden.positions) {
      if (seen.has(position.ticker)) continue;
      if (classifyRangeEffect(ranges[position.ticker]?.range).kind !== "fire") continue;
      const cost = firstSessionCost(ranges[position.ticker]);
      if (cost == null) continue;
      seen.add(position.ticker);
      positions.push({
        ...position,
        id: `firetree_${position.ticker}`,
        gardenId: FIRETREE_ID,
        plotIndex: positions.length,
        quantity: Math.floor(FIRST_SESSION_BUDGET / cost),
        avgCost: cost,
        purchasedAt: FIRETREE_DATE,
      });
    }
  }
  return { id: FIRETREE_ID, name: "파이어트리", positions };
}
