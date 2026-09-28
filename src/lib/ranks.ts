import { marketValue, pnlPct } from "./garden-math";
import type { Garden, Position, RangeCandle } from "./types";

export type RankPeriod = "week" | "month" | "year";

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
  { id: "week", label: "주간", hint: "전일 대비" },
  { id: "month", label: "월간", hint: "당월 시가 대비" },
  { id: "year", label: "연간", hint: "심은 평단 대비" },
];

type PeriodPosition = Pick<
  Position,
  "changePct" | "lastPrice" | "avgCost" | "quantity" | "marketValue" | "unrealizedPnlAmt"
> & { range?: RangeCandle | null };

export function monthReturnPct(range?: RangeCandle | null): number | null {
  if (!range || !(range.open > 0) || !Number.isFinite(range.open) || !Number.isFinite(range.close)) {
    return null;
  }
  return ((range.close - range.open) / range.open) * 100;
}

export function periodReturnPct(position: PeriodPosition, period: RankPeriod): number | null {
  if (period === "week") {
    return Number.isFinite(position.changePct) ? position.changePct : null;
  }
  if (period === "month") {
    return monthReturnPct(position.range);
  }
  if (!(position.avgCost > 0) || !Number.isFinite(position.lastPrice)) return null;
  return pnlPct(position.lastPrice, position.avgCost);
}

export function gardenPeriodReturnPct(
  positions: PeriodPosition[],
  period: RankPeriod,
): number | null {
  if (period === "year") {
    let cost = 0;
    let pnl = 0;
    for (const position of positions) {
      const line = position.quantity * position.avgCost;
      if (!(line > 0)) continue;
      cost += line;
      pnl +=
        position.unrealizedPnlAmt ??
        marketValue(position.quantity, position.lastPrice) - line;
    }
    return cost > 0 ? (pnl / cost) * 100 : null;
  }

  let weighted = 0;
  let mass = 0;
  for (const position of positions) {
    const ret = periodReturnPct(position, period);
    if (ret == null) continue;
    const weight =
      period === "month"
        ? position.quantity * (position.range?.open ?? 0)
        : marketValue(position.quantity, position.lastPrice);
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
): RankedGarden[] {
  const scored = gardens
    .map((garden) => {
      const returnPct = gardenPeriodReturnPct(garden.positions, period);
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
): RankedTree[] {
  const scored: Array<Omit<RankedTree, "rank">> = [];
  for (const garden of gardens) {
    for (const position of garden.positions) {
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
