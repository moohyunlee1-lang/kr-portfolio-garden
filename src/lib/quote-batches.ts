export const GARDEN_QUOTE_BATCH_SIZE = 20;
export const GARDEN_QUOTE_CONCURRENCY = 3;

/** Fetch planted tickers with a small, bounded number of requests in flight. */
export async function loadQuoteBatches<T>(
  codes: readonly string[],
  request: (batch: string[]) => Promise<T[]>,
  onBatch: (rows: T[]) => void,
  isCancelled: () => boolean = () => false,
): Promise<void> {
  let next = 0;
  const batchCount = Math.ceil(codes.length / GARDEN_QUOTE_BATCH_SIZE);
  async function worker() {
    while (!isCancelled() && next < batchCount) {
      const index = next++;
      const batch = codes.slice(index * GARDEN_QUOTE_BATCH_SIZE, (index + 1) * GARDEN_QUOTE_BATCH_SIZE);
      try {
        const rows = await request(batch);
        if (!isCancelled() && rows.length) onBatch(rows);
      } catch {
        // A failed batch must not discard successful batches or block later ones.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(GARDEN_QUOTE_CONCURRENCY, batchCount) }, worker));
}
