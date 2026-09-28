import type {
  Dividend,
  Garden,
  PlantInput,
  Position,
  StoredGarden,
  StoredPosition,
  Weather,
  WeatherRegime,
} from "./types";

export type {
  Dividend,
  Garden,
  GrowthStage,
  Issue,
  PlantInput,
  Position,
  StoredGarden,
  StoredPosition,
  Weather,
  WeatherRegime,
} from "./types";
export { type FruitTone } from "./types";

import type { FruitTone, GrowthStage } from "./types";
import { BASE_PLOTS, layoutFromPositions, layoutFor } from "./plots";

export const MIN_VISUAL_SCALE = 0.38;
export const LAST_GARDEN_KEY = "kr-garden:lastGardenId";
export const PLOT_COUNT = BASE_PLOTS;

export function pnlPct(lastPrice: number, avgCost: number): number {
  if (!(avgCost > 0) || !Number.isFinite(lastPrice)) return 0;
  return ((lastPrice - avgCost) / avgCost) * 100;
}

export function marketValue(quantity: number, lastPrice: number): number {
  if (!(quantity > 0) || !(lastPrice > 0)) return 0;
  return quantity * lastPrice;
}

export function unrealizedPnlAmt(
  quantity: number,
  avgCost: number,
  lastPrice: number,
): number {
  return marketValue(quantity, lastPrice) - quantity * avgCost;
}

export function holdingDays(purchasedAt: string, now: Date): number {
  const [year, month, day] = purchasedAt.split("-").map(Number);
  if (!year || !month || !day) return 0;
  const start = Date.UTC(year, month - 1, day);
  const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((end - start) / 86_400_000);
  return diff > 0 ? diff : 0;
}

export function growthStage(
  unrealizedPnlPct: number,
  days: number,
  dividend?: {
    accruedHint?: boolean;
    isConfirmed?: boolean;
  } | null,
): GrowthStage {
  if (
    unrealizedPnlPct < 0 &&
    (dividend?.accruedHint || dividend?.isConfirmed)
  ) {
    return "sapling";
  }
  if (unrealizedPnlPct < 0 && days < 90) return "seed";
  if (unrealizedPnlPct < 0) return "sprout";
  if (unrealizedPnlPct < 10) return "sapling";
  if (unrealizedPnlPct < 40) return "tree";
  return "lush";
}

export function sizeScale(value: number, maxValue: number): number {
  if (!(maxValue > 0) || !(value > 0)) return MIN_VISUAL_SCALE;
  const ratio = Math.min(1, value / maxValue);
  return MIN_VISUAL_SCALE + (1 - MIN_VISUAL_SCALE) * ratio;
}

function earlierDate(left: string, right: string): string {
  return left <= right ? left : right;
}

function derivePosition(
  position: Position,
  now: Date,
  totalMarketValue: number,
): Position {
  const value = marketValue(position.quantity, position.lastPrice);
  return {
    ...position,
    marketValue: value,
    unrealizedPnlPct: pnlPct(position.lastPrice, position.avgCost),
    unrealizedPnlAmt: unrealizedPnlAmt(
      position.quantity,
      position.avgCost,
      position.lastPrice,
    ),
    holdingDays: holdingDays(position.purchasedAt, now),
    weightPct: totalMarketValue > 0 ? (value / totalMarketValue) * 100 : 0,
  };
}

export function withDerived(positions: Position[], now: Date): Position[] {
  const total = positions.reduce(
    (sum, position) => sum + marketValue(position.quantity, position.lastPrice),
    0,
  );
  return positions.map((position) => derivePosition(position, now, total));
}

export function plantIntoGarden(
  garden: Garden,
  input: PlantInput,
  now: Date,
): { garden: Garden; merged: boolean } {
  if (!(input.quantity > 0)) {
    throw new Error("수량은 0보다 커야 합니다");
  }

  const ticker = input.ticker.trim();
  const positions = garden.positions.map((position) => ({ ...position }));
  const existingIndex = positions.findIndex(
    (position) => position.ticker === ticker,
  );

  if (existingIndex >= 0) {
    const existing = positions[existingIndex];
    const quantity = existing.quantity + input.quantity;
    positions[existingIndex] = {
      ...existing,
      quantity,
      avgCost:
        (existing.quantity * existing.avgCost + input.quantity * input.avgCost) /
        quantity,
      purchasedAt: earlierDate(existing.purchasedAt, input.purchasedAt),
      lastPrice: input.lastPrice,
      changePct: input.changePct,
      volume: input.volume,
      dividend: input.dividend ?? existing.dividend,
      issues: input.issues ?? existing.issues,
    };
    return {
      merged: true,
      garden: { ...garden, positions: withDerived(positions, now) },
    };
  }

  const used = new Set(positions.map((position) => position.plotIndex));
  let plotIndex = input.plotIndex;
  if (used.has(plotIndex)) {
    const free = firstFreePlot(positions);
    if (free == null) throw new Error("빈 칸이 없습니다");
    plotIndex = free;
  }

  const created: Position = {
    id: input.id ?? `pos_${ticker}_${crypto.randomUUID()}`,
    gardenId: garden.id,
    ticker,
    name: input.name,
    sector: input.sector,
    quantity: input.quantity,
    avgCost: input.avgCost,
    purchasedAt: input.purchasedAt,
    lastPrice: input.lastPrice,
    changePct: input.changePct,
    volume: input.volume,
    marketValue: 0,
    unrealizedPnlPct: 0,
    unrealizedPnlAmt: 0,
    weightPct: 0,
    holdingDays: 0,
    plotIndex,
    dividend: input.dividend,
    issues: input.issues,
  };

  return {
    merged: false,
    garden: {
      ...garden,
      positions: withDerived([...positions, created], now),
    },
  };
}

type FruitDividend = {
  expectedDate?: string;
  confirmedDate?: string;
  isConfirmed?: boolean;
  accruedHint?: boolean;
};

export function fruitTone(
  dividend?: FruitDividend | null,
  harvested = false,
): FruitTone {
  if (harvested || !dividend) return "none";
  if (dividend.isConfirmed) return "vivid";
  if (dividend.expectedDate || dividend.accruedHint) return "muted";
  return "none";
}

export function fruitSaturation(
  dividend?: FruitDividend | null,
  harvested = false,
): number {
  const tone = fruitTone(dividend, harvested);
  if (tone === "vivid") return 1;
  if (tone === "muted") return 0.35;
  return 0;
}

export function dividendPayDate(dividend?: FruitDividend | null): string | null {
  if (!dividend) return null;
  if (dividend.isConfirmed && dividend.confirmedDate) return dividend.confirmedDate;
  return dividend.expectedDate ?? null;
}

export function isHarvestDue(
  dividend: FruitDividend | null | undefined,
  today: string,
  harvested: boolean,
): boolean {
  const payDate = dividendPayDate(dividend);
  if (!payDate || harvested) return false;
  return payDate <= today;
}

export function weatherFromKospi(kospiReturn5d: number): Weather {
  const regime: WeatherRegime =
    kospiReturn5d >= 1.5 ? "bull" : kospiReturn5d <= -1.5 ? "bear" : "neutral";
  return { regime, kospiReturn5d };
}

type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function readLastGardenId(storage: Pick<KeyValueStore, "getItem">): string | null {
  const value = storage.getItem(LAST_GARDEN_KEY);
  return value ? value : null;
}

export function writeLastGardenId(
  storage: Pick<KeyValueStore, "setItem">,
  id: string,
): void {
  storage.setItem(LAST_GARDEN_KEY, id);
}

export function maxMarketValue(positions: Array<{ marketValue: number }>): number {
  return positions.reduce((max, position) => Math.max(max, position.marketValue), 0);
}

export function gardenSnapshot(positions: Position[]) {
  const value = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const cost = positions.reduce(
    (sum, position) => sum + position.quantity * position.avgCost,
    0,
  );
  const unrealizedPnlAmt = positions.reduce(
    (sum, position) => sum + position.unrealizedPnlAmt,
    0,
  );
  return {
    marketValue: value,
    cost,
    unrealizedPnlAmt,
    unrealizedPnlPct: cost > 0 ? (unrealizedPnlAmt / cost) * 100 : 0,
    count: positions.length,
  };
}

export function materializePosition(
  stored: StoredPosition,
  quote: {
    lastPrice: number;
    changePct: number;
    volume: number;
    dividend?: Dividend;
    issues?: Position["issues"];
  },
  now: Date,
  totalMarketValue: number,
): Position {
  return derivePosition(
    {
      id: stored.id,
      gardenId: stored.gardenId,
      plotIndex: stored.plotIndex,
      ticker: stored.ticker,
      name: stored.name,
      sector: stored.sector,
      quantity: stored.quantity,
      avgCost: stored.avgCost,
      purchasedAt: stored.purchasedAt,
      lastPrice: quote.lastPrice,
      changePct: quote.changePct,
      volume: quote.volume,
      marketValue: 0,
      unrealizedPnlPct: 0,
      unrealizedPnlAmt: 0,
      weightPct: 0,
      holdingDays: 0,
      dividend: quote.dividend,
      issues: quote.issues,
    },
    now,
    totalMarketValue,
  );
}

export function materializeGarden(
  stored: StoredGarden,
  quotes: Record<
    string,
    {
      lastPrice: number;
      changePct: number;
      volume: number;
      dividend?: Dividend;
      issues?: Position["issues"];
    }
  >,
  now: Date,
): Garden {
  const drafts = stored.positions.map((position) => {
    const quote = quotes[position.ticker] ?? {
      lastPrice: 0,
      changePct: 0,
      volume: 0,
    };
    return {
      position,
      quote,
      value: marketValue(position.quantity, quote.lastPrice),
    };
  });
  const total = drafts.reduce((sum, draft) => sum + draft.value, 0);
  return {
    id: stored.id,
    name: stored.name,
    positions: drafts.map((draft) =>
      materializePosition(draft.position, draft.quote, now, total),
    ),
  };
}

export function toStoredGarden(garden: Garden, sample = false, group?: string): StoredGarden {
  return {
    id: garden.id,
    name: garden.name,
    sample,
    group,
    positions: garden.positions.map((position) => ({
      id: position.id,
      gardenId: position.gardenId,
      plotIndex: position.plotIndex,
      ticker: position.ticker,
      name: position.name,
      sector: position.sector,
      quantity: position.quantity,
      avgCost: position.avgCost,
      purchasedAt: position.purchasedAt,
    })),
  };
}

export function todayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function firstFreePlot(
  positions: Array<{ plotIndex: number }>,
  preferred?: number,
): number | null {
  const used = new Set(positions.map((position) => position.plotIndex));
  const layout = layoutFromPositions(positions);
  const capacity = Math.max(layout.count, layoutFor(positions.length + 1).count);
  if (preferred != null && preferred >= 0 && preferred < capacity && !used.has(preferred)) {
    return preferred;
  }
  for (let index = 0; index < capacity; index += 1) {
    if (!used.has(index)) return index;
  }
  return capacity;
}
