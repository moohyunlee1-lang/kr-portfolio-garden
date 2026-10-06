import { FIRETREE_ID, firstSessionCost } from "./firetree-seed";

export function isYtdGarden(id: string): boolean {
  return id === FIRETREE_ID || id === "ma_watch" || id === "cross_watch";
}

/** Linear 1× at the first close; clamp to 0.65–1.6× so outliers remain legible. */
export function ytdSizeScale(lastPrice: number, quote?: { yearFirstDate?: string | null; yearFirstClose?: number | null }): number {
  const seed = firstSessionCost(quote);
  if (seed == null || !Number.isFinite(lastPrice) || lastPrice <= 0) return 1;
  return Math.max(0.65, Math.min(1.6, lastPrice / seed));
}
