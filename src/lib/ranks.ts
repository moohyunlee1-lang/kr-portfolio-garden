import { marketValue } from "./garden-math";
import type { Garden, PeriodBaselines, Position } from "./types";

export type RankPeriod = "day" | "week" | "month" | "year";

export type RankedGarden = {
  rank: number;
  id: string;
  name: string;
  group?: string;
  returnPct: number;
  count: number;
};

export type RankedTree = {
  rank: number;
  gardenId: string;
  gardenName: string;
  positionId: string;
  ticker: string;
  name: string;
  returnPct: number;
};

export const RANK_PERIODS: Array<{ id: RankPeriod; label: string; hint: string }> = [
  { id: "day", label: "일간", hint: "당일 기준 · 10분마다" },
  { id: "week", label: "주간", hint: "이번 주 시가 대비" },
  { id: "month", label: "월간", hint: "이번 달 시가 대비" },
  { id: "year", label: "연간", hint: "연초 시가 대비" },
];

type PeriodPosition = Pick<
  Position,
  "ticker" | "changePct" | "lastPrice" | "avgCost" | "quantity" | "marketValue" | "unrealizedPnlAmt"
> & { period?: PeriodBaselines | null };

function baselineFor(position: PeriodPosition, period: Exclude<RankPeriod, "day">): number | null {
  const baseline =
    period === "week"
      ? position.period?.weekOpen
      : period === "month"
        ? position.period?.monthOpen
        : position.period?.yearOpen;
  return typeof baseline === "number" && baseline > 0 && Number.isFinite(baseline)
    ? baseline
    : null;
}

export function periodReturnPct(position: PeriodPosition, period: RankPeriod): number | null {
  if (period === "day") {
    return Number.isFinite(position.changePct) ? position.changePct : null;
  }
  const baseline = baselineFor(position, period);
  if (baseline == null || !(position.lastPrice > 0) || !Number.isFinite(position.lastPrice)) return null;
  return ((position.lastPrice - baseline) / baseline) * 100;
}

export function gardenPeriodReturnPct(
  positions: PeriodPosition[],
  period: RankPeriod,
): number | null {
  let weighted = 0;
  let mass = 0;
  for (const position of positions) {
    const ret = periodReturnPct(position, period);
    if (ret == null) continue;
    const baseline = period === "day" ? null : baselineFor(position, period);
    const weight = period === "day"
      ? marketValue(position.quantity, position.lastPrice)
      : position.quantity * (baseline ?? 0);
    if (!(weight > 0)) continue;
    weighted += weight * ret;
    mass += weight;
  }
  if (!(mass > 0)) return null;
  return weighted / mass;
}

export function rankGardens(
  gardens: Array<Pick<Garden, "id" | "name"> & { group?: string; positions: PeriodPosition[] }>,
  period: RankPeriod,
  liveTickers?: ReadonlySet<string>,
): RankedGarden[] {
  const scored = gardens
    .map((garden) => {
      const positions = positionsForPeriod(garden.positions, period, liveTickers);
      const returnPct = gardenPeriodReturnPct(positions, period);
      if (returnPct == null) return null;
      return {
        id: garden.id,
        name: garden.name,
        group: garden.group,
        returnPct,
        count: garden.positions.length,
      };
    })
    .filter((row): row is Exclude<typeof row, null> => row != null);
  return assignRanks(scored, (row) => row.returnPct, (a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id));
}

export function rankTrees(
  gardens: Array<Pick<Garden, "id" | "name"> & { positions: Position[] }>,
  period: RankPeriod,
  liveTickers?: ReadonlySet<string>,
): RankedTree[] {
  const scored: Array<Omit<RankedTree, "rank">> = [];
  for (const garden of gardens) {
    for (const position of positionsForPeriod(garden.positions, period, liveTickers)) {
      const returnPct = periodReturnPct(position, period);
      if (returnPct == null) continue;
      scored.push({
        gardenId: garden.id,
        gardenName: garden.name,
        positionId: position.id,
        ticker: position.ticker,
        name: position.name,
        returnPct,
      });
    }
  }
  return assignRanks(
    scored,
    (row) => row.returnPct,
    (a, b) => a.name.localeCompare(b.name, "ko") || a.positionId.localeCompare(b.positionId),
  );
}

function positionsForPeriod<T extends { ticker: string }>(
  positions: T[],
  period: RankPeriod,
  liveTickers?: ReadonlySet<string>,
): T[] {
  if (period !== "day") return positions;
  if (!liveTickers) return [];
  return positions.filter((position) => liveTickers.has(position.ticker));
}

function sameReturn(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-9;
}

function assignRanks<T>(
  items: T[],
  score: (item: T) => number,
  tieBreak: (a: T, b: T) => number,
): Array<T & { rank: number }> {
  const sorted = [...items].sort((a, b) => {
    const delta = score(b) - score(a);
    if (!sameReturn(score(a), score(b))) return delta;
    return tieBreak(a, b);
  });
  let lastScore: number | undefined;
  let lastRank = 0;
  return sorted.map((item, index) => {
    const value = score(item);
    const rank = lastScore != null && sameReturn(value, lastScore) ? lastRank : index + 1;
    lastScore = value;
    lastRank = rank;
    return { ...item, rank };
  });
}
