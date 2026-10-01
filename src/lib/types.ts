export type GrowthStage = "seed" | "sprout" | "sapling" | "tree" | "lush";
export type FruitTone = "muted" | "vivid" | "none";
export type WeatherRegime = "bull" | "bear" | "neutral";

export type Issue = {
  type: "news" | "disclosure";
  title: string;
  source: string;
  publishedAt: string;
};

export type RangeCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  yearHigh: number;
  yearLow: number;
};

export type PeriodBaselines = {
  weekOpen?: number | null;
  monthOpen?: number | null;
  yearOpen?: number | null;
};

export type Fundamentals = {
  marketCap?: number | null;
  per?: number | null;
  pbr?: number | null;
  eps?: number | null;
  bps?: number | null;
  debtRatioPct?: number | null;
  debtPerShare?: number | null;
};

export type Dividend = {
  expectedDate?: string;
  confirmedDate?: string;
  isConfirmed: boolean;
  lastAmount: number;
  yieldPct: number;
  accruedHint?: boolean;
};

export type Position = {
  id: string;
  gardenId: string;
  ticker: string;
  name: string;
  sector: string;
  quantity: number;
  avgCost: number;
  purchasedAt: string;
  lastPrice: number;
  changePct: number;
  volume: number;
  marketValue: number;
  unrealizedPnlPct: number;
  unrealizedPnlAmt: number;
  weightPct: number;
  holdingDays: number;
  plotIndex: number;
  dividend?: Dividend;
  issues?: Issue[];
  fundamentals?: Fundamentals;
  range?: RangeCandle;
  period?: PeriodBaselines;
};

export type Garden = {
  id: string;
  name: string;
  positions: Position[];
};

export type PlantInput = {
  ticker: string;
  name: string;
  sector: string;
  quantity: number;
  avgCost: number;
  purchasedAt: string;
  plotIndex: number;
  lastPrice: number;
  changePct: number;
  volume: number;
  dividend?: Dividend;
  issues?: Issue[];
  id?: string;
};

export type Weather = {
  regime: WeatherRegime;
  kospiReturn1d: number;
  kosdaqReturn1d: number;
};

export type StoredPosition = {
  id: string;
  gardenId: string;
  plotIndex: number;
  ticker: string;
  name: string;
  sector: string;
  quantity: number;
  avgCost: number;
  purchasedAt: string;
};

export type StoredGarden = {
  id: string;
  name: string;
  positions: StoredPosition[];
  sample?: boolean;
  group?: string;
};
