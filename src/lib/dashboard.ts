import type { Garden } from "./types";
export type Totals = {
  cost: number;
  marketValue: number | null;
  profit: number | null;
  returnPct: number | null;
};
export type DashboardStock = Totals & {
  ticker: string;
  name: string;
  sector: string;
  quantity: number;
  weightPct: number | null;
};
export type DashboardSector = Totals & {
  name: string;
  stocks: DashboardStock[];
  weightPct: number | null;
};
export type Dashboard = Totals & {
  gardenId: string;
  name: string;
  createdAt: string;
  stocks: DashboardStock[];
  sectors: DashboardSector[];
};
export const money = (v: number | null) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : `${(v / 100_000_000).toFixed(2)}억원`;
export const percent = (v: number | null) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
export function totals(rows: Totals[]): Totals {
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const marketValue = rows.some((r) => r.marketValue == null)
    ? null
    : rows.reduce((s, r) => s + r.marketValue!, 0);
  const profit = marketValue == null ? null : marketValue - cost;
  return {
    cost,
    marketValue,
    profit,
    returnPct: cost > 0 && profit != null ? (profit / cost) * 100 : null,
  };
}
export const descending = (a: number | null, b: number | null) =>
  (b ?? -Infinity) - (a ?? -Infinity);
export function rankedStocks(stocks: DashboardStock[]) {
  const ranked = [...stocks]
    .filter((s) => s.returnPct != null)
    .sort(
      (a, b) =>
        descending(a.returnPct, b.returnPct) ||
        a.ticker.localeCompare(b.ticker),
    )
    .map((s, i) => ({ ...s, rank: i + 1 }));
  return ranked.length <= 60
    ? ranked
    : [...ranked.slice(0, 30), ...ranked.slice(-30)];
}
export function buildDashboard(
  garden: Garden,
  sectors: Record<string, string>,
  createdAt: string,
): Dashboard {
  const grouped = new Map<string, DashboardStock[]>();
  for (const p of garden.positions) {
    const quantity =
      Number.isFinite(p.quantity) && p.quantity >= 0 ? p.quantity : 0;
    const cost =
      quantity * (Number.isFinite(p.avgCost) && p.avgCost >= 0 ? p.avgCost : 0);
    const marketValue =
      Number.isFinite(p.lastPrice) && p.lastPrice > 0
        ? quantity * p.lastPrice
        : null;
    const row = {
      ticker: p.ticker,
      name: p.name,
      sector: sectors[p.ticker] || "미분류·검토 필요",
      quantity,
      cost,
      marketValue,
      profit: null,
      returnPct: null,
      weightPct: null,
    };
    grouped.set(p.ticker, [...(grouped.get(p.ticker) ?? []), row]);
  }
  const stocks: DashboardStock[] = [...grouped.values()].map((rows) => ({
    ...rows[0],
    ...totals(rows),
    quantity: rows.reduce((s, r) => s + r.quantity, 0),
  }));
  const total = totals(stocks);
  for (const row of stocks)
    row.weightPct =
      total.marketValue && row.marketValue != null
        ? (row.marketValue / total.marketValue) * 100
        : null;
  const groups = [...new Set(stocks.map((s) => s.sector))]
    .map((name) => {
      const rows = stocks.filter((s) => s.sector === name),
        value = totals(rows);
      return {
        ...value,
        name,
        stocks: rows,
        weightPct:
          total.marketValue && value.marketValue != null
            ? (value.marketValue / total.marketValue) * 100
            : null,
      };
    })
    .sort((a, b) => descending(a.marketValue, b.marketValue));
  return {
    ...total,
    gardenId: garden.id,
    name: garden.name,
    createdAt,
    stocks,
    sectors: groups,
  };
}
