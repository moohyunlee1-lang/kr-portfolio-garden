"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createSampleGarden } from "@/lib/demo";
import {
  firstFreePlot,
  materializeGarden,
  plantIntoGarden,
  toStoredGarden,
  writeLastGardenId,
} from "@/lib/garden-math";
import { applyLiveQuotes } from "@/lib/market/chain";
import type { LiveQuote } from "@/lib/market/types";
import { quoteRecord } from "@/lib/quotes";
import { rangeWithLivePrice } from "@/lib/range-effects";
import type { RangeCandle } from "@/lib/types";
import {
  dropGarden,
  ensureEntry,
  loadHarvested,
  loadHidden,
  saveGardens,
  saveHarvested,
  saveHidden,
} from "@/lib/storage";
import type { Garden, StoredGarden } from "@/lib/types";

type PlantDraft = {
  ticker: string;
  quantity: number;
  avgCost: number;
  purchasedAt: string;
  plotIndex?: number;
};

type GardenContextValue = {
  ready: boolean;
  gardens: StoredGarden[];
  entryId: string | null;
  harvested: string[];
  view: (gardenId: string) => Garden | null;
  remember: (gardenId: string) => void;
  createGarden: (name?: string) => string;
  renameGarden: (gardenId: string, name: string) => void;
  addSample: () => string;
  deleteGarden: (gardenId: string) => string | null;
  plant: (gardenId: string, draft: PlantDraft) => { merged: boolean; positionId: string };
  markHarvested: (key: string) => void;
  applyLive: (rows: LiveQuote[]) => void;
  liveTickers: ReadonlySet<string>;
  rangeFor: (ticker: string) => RangeCandle | undefined;
};

const GardenContext = createContext<GardenContextValue | null>(null);

function uniqueName(gardens: StoredGarden[], base: string): string {
  const names = new Set(gardens.map((garden) => garden.name));
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

export function GardenProvider({ children }: { children: React.ReactNode }) {
  const [gardens, setGardens] = useState<StoredGarden[]>([]);
  const [harvested, setHarvested] = useState<string[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<LiveQuote[]>([]);
  const quotes = useMemo(() => {
    const merged = applyLiveQuotes(quoteRecord(), live);
    for (const row of live) {
      const quote = merged[row.ticker];
      if (quote && row.lastPrice > 0) {
        merged[row.ticker] = { ...quote, range: rangeWithLivePrice(quote.range, row.lastPrice) };
      }
    }
    return merged;
  }, [live]);
  const rangeFor = useCallback((ticker: string) => quotes[ticker]?.range, [quotes]);
  const liveTickers = useMemo(() => new Set(live.map((row) => row.ticker)), [live]);

  useEffect(() => {
    const entry = ensureEntry(localStorage);
    setGardens(entry.gardens);
    setEntryId(entry.gardenId);
    setHarvested(loadHarvested(localStorage));
    setReady(true);
  }, []);

  const persist = useCallback((next: StoredGarden[]) => {
    setGardens(next);
    saveGardens(localStorage, next);
  }, []);

  const remember = useCallback((gardenId: string) => {
    writeLastGardenId(localStorage, gardenId);
    setEntryId(gardenId);
  }, []);

  const view = useCallback(
    (gardenId: string) => {
      const stored = gardens.find((garden) => garden.id === gardenId);
      if (!stored) return null;
      return materializeGarden(stored, quotes, new Date());
    },
    [gardens, quotes],
  );

  const createGarden = useCallback(
    (name?: string) => {
      const id = `garden_${crypto.randomUUID()}`;
      const next = [
        ...gardens,
        {
          id,
          name: uniqueName(gardens, name?.trim() || "새 정원"),
          positions: [],
        },
      ];
      persist(next);
      remember(id);
      return id;
    },
    [gardens, persist, remember],
  );

  const renameGarden = useCallback(
    (gardenId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      persist(
        gardens.map((garden) =>
          garden.id === gardenId ? { ...garden, name: trimmed } : garden,
        ),
      );
    },
    [gardens, persist],
  );

  const addSample = useCallback(() => {
    const existing = gardens.find((garden) => garden.sample);
    if (existing) {
      remember(existing.id);
      return existing.id;
    }
    const id = `garden_${crypto.randomUUID()}`;
    persist([...gardens, createSampleGarden(id)]);
    remember(id);
    return id;
  }, [gardens, persist, remember]);

  const deleteGarden = useCallback(
    (gardenId: string) => {
      const result = dropGarden(gardens, gardenId);
      if (!result) return null;
      if (result.hidden) {
        saveHidden(localStorage, [...loadHidden(localStorage), gardenId]);
      }
      persist(result.gardens);
      const stay = result.gardens.some((garden) => garden.id === entryId) ? entryId : result.nextId;
      remember(stay!);
      return stay;
    },
    [entryId, gardens, persist, remember],
  );

  const applyLive = useCallback((rows: LiveQuote[]) => {
    setLive((current) => {
      const map = new Map(current.map((row) => [row.ticker, row]));
      for (const row of rows) {
        if (row.lastPrice > 0) map.set(row.ticker, row);
      }
      return [...map.values()];
    });
  }, []);

  const plant = useCallback(
    (gardenId: string, draft: PlantDraft) => {
      const quote = quotes[draft.ticker.trim()];
      if (!quote) throw new Error("한국 상장 종목만 심을 수 있습니다");
      if (!(draft.quantity > 0)) throw new Error("수량은 0보다 커야 합니다");
      if (!(draft.avgCost > 0)) throw new Error("평단은 0보다 커야 합니다");
      const stored = gardens.find((garden) => garden.id === gardenId);
      if (!stored) throw new Error("정원을 찾을 수 없습니다");
      const now = new Date();
      const materialized = materializeGarden(stored, quotes, now);
      const same = materialized.positions.find((position) => position.ticker === quote.ticker);
      const plotIndex = same
        ? same.plotIndex
        : firstFreePlot(materialized.positions, draft.plotIndex);
      if (plotIndex == null) throw new Error("빈 칸이 없습니다");
      const result = plantIntoGarden(
        materialized,
        {
          ticker: quote.ticker,
          name: quote.name,
          sector: quote.sector,
          quantity: draft.quantity,
          avgCost: draft.avgCost,
          purchasedAt: draft.purchasedAt,
          plotIndex,
          lastPrice: quote.lastPrice,
          changePct: quote.changePct,
          volume: quote.volume,
          dividend: quote.dividend,
          issues: quote.issues,
          id: `pos_${crypto.randomUUID()}`,
        },
        now,
      );
      const nextStored = toStoredGarden(result.garden, Boolean(stored.sample), stored.group);
      persist(gardens.map((garden) => (garden.id === gardenId ? nextStored : garden)));
      const position = result.garden.positions.find((item) => item.ticker === quote.ticker);
      if (!position) throw new Error("심기 결과를 찾지 못했습니다");
      return { merged: result.merged, positionId: position.id };
    },
    [gardens, persist, quotes],
  );

  const markHarvested = useCallback((key: string) => {
    setHarvested((current) => {
      if (current.includes(key)) return current;
      const next = [...current, key];
      saveHarvested(localStorage, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      gardens,
      entryId,
      harvested,
      view,
      remember,
      createGarden,
      renameGarden,
      addSample,
      deleteGarden,
      plant,
      markHarvested,
      applyLive,
      liveTickers,
      rangeFor,
    }),
    [
      ready,
      gardens,
      entryId,
      harvested,
      view,
      remember,
      createGarden,
      renameGarden,
      addSample,
      deleteGarden,
      plant,
      markHarvested,
      applyLive,
      liveTickers,
      rangeFor,
    ],
  );

  return <GardenContext.Provider value={value}>{children}</GardenContext.Provider>;
}

export function useGardens() {
  const value = useContext(GardenContext);
  if (!value) throw new Error("GardenProvider가 없습니다");
  return value;
}
