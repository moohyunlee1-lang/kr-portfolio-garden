export type FreshnessInput = { available: boolean; sourceAsOf: string | null; capturedAt?: string | null; complete: boolean | null };
export type Freshness = { status: "fresh" | "stale" | "partial" | "missing" | "unknown"; ageDays: number | null; stale: boolean };
// A wall-clock date never establishes the latest completed KRX session.
export function assessDataset(input: FreshnessInput, id: string, now: string, maxAgeDays: number, expectedMarketDate: string | null): Freshness {
  if (!["quotes", "ma", "cross", "high52-dual"].includes(id)) return assessFreshness(input, now, maxAgeDays);
  const missingReference: Freshness = { status: !input.available ? "missing" : input.complete === false ? "partial" : "unknown", ageDays: null, stale: false };
  if (!expectedMarketDate || !/^\d{4}-\d{2}-\d{2}$/.test(expectedMarketDate)) return missingReference;
  if (assessFreshness({available:true,sourceAsOf:expectedMarketDate,complete:true}, now, Number.MAX_SAFE_INTEGER).status === "unknown") return missingReference;
  return assessFreshness(input, expectedMarketDate + "T23:59:59+09:00", maxAgeDays);
}

export function assessFreshness(input: FreshnessInput, now: string, maxAgeDays: number): Freshness {
  const unknown: Freshness = { status: "unknown", ageDays: null, stale: false };
  if (!input.available) return { ...unknown, status: "missing" };
  const source = input.sourceAsOf;
  if (!source) return { ...unknown, status: input.complete === false ? "partial" : "unknown" };
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(source);
  const calendarDate = source.slice(0, 10);
  const calendarMs = Date.parse(calendarDate + "T00:00:00Z");
  if (!Number.isFinite(calendarMs) || new Date(calendarMs).toISOString().slice(0, 10) !== calendarDate) return unknown;
  if (!dateOnly && !/(Z|[+-]\d{2}:\d{2})$/.test(source)) return unknown;
  const instant = Date.parse(dateOnly ? source + "T00:00:00+09:00" : source);
  const current = Date.parse(now);
  if (!Number.isFinite(instant) || !Number.isFinite(current) || instant > current || !Number.isFinite(maxAgeDays) || maxAgeDays < 0) return unknown;
  const seoulDay = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
  if (dateOnly && seoulDay(instant) !== source) return unknown;
  const ageDays = Math.round((Date.parse(seoulDay(current)) - Date.parse(seoulDay(instant))) / 86400000);
  const stale = ageDays > maxAgeDays;
  return { status: input.complete === false ? "partial" : stale ? "stale" : input.complete === null ? "unknown" : "fresh", ageDays, stale };
}
