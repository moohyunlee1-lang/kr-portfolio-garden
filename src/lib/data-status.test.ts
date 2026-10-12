import { describe, expect, it } from "vitest";
import { assessFreshness, assessDataset } from "./data-status";

it("requires a declared market date for daily sources, not the wall-clock weekday", () => {
  const input = { available: true, sourceAsOf: "2026-10-02", complete: true };
  expect(assessDataset(input, "cross", "2026-10-12T12:00:00+09:00", 0, null).status).toBe("unknown");
  expect(assessDataset(input, "cross", "2026-10-12T12:00:00+09:00", 0, "2026-10-02")).toEqual({status:"fresh",ageDays:0,stale:false});
  expect(assessDataset(input, "cross", "2026-10-12T12:00:00+09:00", 0, "2026-10-05").status).toBe("stale");
  expect(assessDataset(input, "cross", "2026-10-12T12:00:00+09:00", 0, "2026-02-30").status).toBe("unknown");
  expect(assessDataset(input, "cross", "2026-10-12T12:00:00+09:00", 0, "2026-10-13").status).toBe("unknown");
  expect(assessDataset(input, "disclosures", "2026-10-12T12:00:00+09:00", 7, null).status).toBe("stale");
});

describe("freshness: source time is not collection time", () => {
  it.each([
    [false, null, true, "missing", null, false],
    [true, "2026-10-02", false, "partial", 10, true],
    [true, "2026-10-12", true, "fresh", 0, false],
    [true, "2026-10-08", true, "stale", 4, true],
    [true, "2026-10-12", null, "unknown", 0, false],
    [true, "2026-10-13", true, "unknown", null, false],
    [true, "2026-02-30", true, "unknown", null, false],
    [true, "2026-02-30T08:00:00Z", true, "unknown", null, false],
    [true, "2026-10-12T23:00:00+09:00", true, "unknown", null, false],
    [true, "2026-10-11T23:30:00-04:00", true, "fresh", 0, false],
  ] as const)("assesses %s %s %s", (available, sourceAsOf, complete, status, ageDays, stale) => {
    expect(assessFreshness({ available, sourceAsOf, complete }, "2026-10-12T13:00:00+09:00", 3)).toEqual({ status, ageDays, stale });
  });
  it("uses configured calendar-day limits and rejects invalid limits", () => {
    const d = { available: true, sourceAsOf: "2026-10-08", complete: true };
    expect(assessFreshness(d, "2026-10-12T12:00:00+09:00", 4).status).toBe("fresh");
    expect(assessFreshness(d, "2026-10-12T12:00:00+09:00", Number.NaN).status).toBe("unknown");
  });
  it("keeps a missing source time unknown even when captured today", () => {
    expect(assessFreshness({ available: true, sourceAsOf: null, capturedAt: "2026-10-12T09:00:00+09:00", complete: true }, "2026-10-12T12:00:00+09:00", 3)).toEqual({ status: "unknown", ageDays: null, stale: false });
  });
});
