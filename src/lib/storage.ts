import type { StoredGarden } from "./types";
import { readLastGardenId, writeLastGardenId } from "./garden-math";
import { mergeCbGardens, isGeneratedGarden } from "./cb-issuance-seed";
import { mergeGroupGardens } from "./group-seed";
import { mergeValueChainGardens } from "./valuechain-seed";
import { FIRETREE_ID, seedFireTreeGarden } from "./firetree-seed";
import { quoteRecord } from "./quotes";
import { classifyRangeEffect } from "./range-effects";

export const GARDENS_KEY = "kr-garden:gardens";
export const HARVEST_KEY = "kr-garden:harvested";
export const HIDDEN_KEY = "kr-garden:hidden";
const FIRETREE_REVIEW_KEY = "kr-garden:firetree-range-reviewed-v2";

type Store = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function readJson<T>(storage: Pick<Store, "getItem">, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadGardens(storage: Pick<Store, "getItem">): StoredGarden[] {
  const parsed = readJson<StoredGarden[]>(storage, GARDENS_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveGardens(storage: Pick<Store, "setItem">, gardens: StoredGarden[]): void {
  storage.setItem(GARDENS_KEY, JSON.stringify(gardens));
}

export function loadHarvested(storage: Pick<Store, "getItem">): string[] {
  const parsed = readJson<string[]>(storage, HARVEST_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveHarvested(storage: Pick<Store, "setItem">, keys: string[]): void {
  storage.setItem(HARVEST_KEY, JSON.stringify(keys));
}

export function harvestKey(positionId: string, payDate: string): string {
  return `${positionId}:${payDate}`;
}

export function loadHidden(storage: Pick<Store, "getItem">): string[] {
  const parsed = readJson<string[]>(storage, HIDDEN_KEY);
  return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
}

export function saveHidden(storage: Pick<Store, "setItem">, ids: string[]): void {
  storage.setItem(HIDDEN_KEY, JSON.stringify([...new Set(ids)]));
}

export function applyHidden(gardens: StoredGarden[], hidden: string[]): StoredGarden[] {
  if (!hidden.length) return gardens;
  const skip = new Set(hidden);
  return gardens.filter((garden) => !skip.has(garden.id));
}

export function dropGarden(
  gardens: StoredGarden[],
  gardenId: string,
): { gardens: StoredGarden[]; nextId: string; hidden: boolean } | null {
  if (gardens.length <= 1) return null;
  const remaining = gardens.filter((garden) => garden.id !== gardenId);
  if (remaining.length === gardens.length || remaining.length === 0) return null;
  return {
    gardens: remaining,
    nextId: remaining[0].id,
    hidden: isGeneratedGarden(gardenId),
  };
}

export function ensureEntry(
  storage: Store,
  createId: () => string = () => `garden_${crypto.randomUUID()}`,
): { gardens: StoredGarden[]; gardenId: string } {
  let gardens = loadGardens(storage);
  if (gardens.length === 0) {
    gardens = [
      {
        id: createId(),
        name: "나의 정원",
        positions: [],
      },
    ];
  }
  const merged = mergeGroupGardens(mergeCbGardens(mergeValueChainGardens(gardens)));
  if (merged !== gardens) {
    saveGardens(storage, merged);
    gardens = merged;
  }
  gardens = applyHidden(gardens, loadHidden(storage));
  if (gardens.length === 0) {
    gardens = [
      {
        id: createId(),
        name: "나의 정원",
        positions: [],
      },
    ];
    saveGardens(storage, mergeGroupGardens(mergeCbGardens(mergeValueChainGardens(gardens))));
    gardens = applyHidden(
      mergeGroupGardens(mergeCbGardens(mergeValueChainGardens(gardens))),
      loadHidden(storage),
    );
  }

  if (!gardens.some((garden) => garden.id === FIRETREE_ID) && !loadHidden(storage).includes(FIRETREE_ID)) {
    gardens = [...gardens, seedFireTreeGarden(gardens)];
    saveGardens(storage, gardens);
    storage.setItem(FIRETREE_REVIEW_KEY, "1");
  } else if (gardens.some((garden) => garden.id === FIRETREE_ID) && storage.getItem(FIRETREE_REVIEW_KEY) !== "1") {
    // Correct the one-time snapshot from before stale candles were excluded.
    const quotes = quoteRecord();
    gardens = gardens.map((garden) => garden.id !== FIRETREE_ID ? garden : {
      ...garden,
      positions: garden.positions
        .filter((position) => classifyRangeEffect(quotes[position.ticker]?.range).kind === "fire")
        .map((position, plotIndex) => ({ ...position, plotIndex })),
    });
    saveGardens(storage, gardens);
    storage.setItem(FIRETREE_REVIEW_KEY, "1");
  }

  const last = readLastGardenId(storage);
  const found = gardens.find((garden) => garden.id === last);
  if (found) return { gardens, gardenId: found.id };

  writeLastGardenId(storage, gardens[0].id);
  return { gardens, gardenId: gardens[0].id };
}
