import { describe, expect, it } from "vitest";
import { GARDEN_QUOTE_BATCH_SIZE, GARDEN_QUOTE_CONCURRENCY, loadQuoteBatches } from "./quote-batches";

describe("loadQuoteBatches", () => {
  it("covers a 933-ticker garden with bounded concurrency and no dropped batch", async () => {
    const codes = Array.from({ length: 933 }, (_, index) => String(index).padStart(6, "0"));
    const pending: Array<() => void> = [];
    const seen: string[][] = [];
    const applied: string[] = [];
    let active = 0;
    let peak = 0;
    const loading = loadQuoteBatches(
      codes,
      (batch) => new Promise<string[]>((resolve) => {
        seen.push(batch);
        active++;
        peak = Math.max(peak, active);
        pending.push(() => {
          active--;
          resolve(batch);
        });
      }),
      (rows) => applied.push(...rows),
    );
    expect(seen).toHaveLength(GARDEN_QUOTE_CONCURRENCY);
    while (applied.length < codes.length) {
      const finish = pending.shift();
      expect(finish).toBeDefined();
      finish!();
      await Promise.resolve();
      await Promise.resolve();
    }
    await loading;
    expect(peak).toBe(GARDEN_QUOTE_CONCURRENCY);
    expect(seen).toHaveLength(Math.ceil(codes.length / GARDEN_QUOTE_BATCH_SIZE));
    expect(seen.every((batch) => batch.length <= GARDEN_QUOTE_BATCH_SIZE)).toBe(true);
    expect(seen.flat()).toEqual(codes);
    expect([...applied].sort()).toEqual([...codes].sort());
  });

  it("applies successes as they arrive even when another batch fails", async () => {
    const applied: string[][] = [];
    let finishFirst!: (rows: string[]) => void;
    const loading = loadQuoteBatches(
      Array.from({ length: 41 }, (_, index) => String(index)),
      (batch) => {
        if (batch[0] === "0") return new Promise<string[]>((resolve) => { finishFirst = resolve; });
        if (batch[0] === "20") return Promise.reject(new Error("batch unavailable"));
        return Promise.resolve(batch);
      },
      (rows) => applied.push(rows),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(applied).toEqual([["40"]]);
    finishFirst(["0"]);
    await loading;
    expect(applied).toEqual([["40"], ["0"]]);
  });

  it("stops scheduling and applying after cancellation", async () => {
    let cancelled = false;
    const finishers: Array<(rows: string[]) => void> = [];
    let requests = 0;
    const applied: string[] = [];
    const loading = loadQuoteBatches(
      Array.from({ length: 100 }, (_, index) => String(index)),
      () => {
        requests++;
        return new Promise<string[]>((resolve) => { finishers.push(resolve); });
      },
      (rows) => applied.push(...rows),
      () => cancelled,
    );
    cancelled = true;
    finishers.forEach((finish) => finish(["ok"]));
    await loading;
    expect(applied).toEqual([]);
    expect(requests).toBe(GARDEN_QUOTE_CONCURRENCY);
  });
});
