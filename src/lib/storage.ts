import type { StoredGarden } from "./types";
import { readLastGardenId, writeLastGardenId } from "./garden-math";
import { mergeValueChainGardens } from "./valuechain-seed";

export const GARDENS_KEY = "kr-garden:gardens";
export const HARVEST_KEY = "kr-garden:harvested";

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
  const merged = mergeValueChainGardens(gardens);
  if (merged !== gardens) {
    saveGardens(storage, merged);
    gardens = merged;
  }

  const last = readLastGardenId(storage);
  const found = gardens.find((garden) => garden.id === last);
  if (found) return { gardens, gardenId: found.id };

  writeLastGardenId(storage, gardens[0].id);
  return { gardens, gardenId: gardens[0].id };
}
