import type { StoredGarden, StoredPosition } from "./types";
import raw from "../data/cb-gardens.generated.json";

type RawGarden = {
  id: string;
  name: string;
  sectorName: string;
  positions: Array<Omit<StoredPosition, "gardenId"> & { gardenId?: string }>;
};

export function cbIssuanceGardens(): StoredGarden[] {
  return (raw as RawGarden[]).map((garden) => ({
    id: garden.id,
    name: garden.name,
    group: garden.sectorName,
    positions: garden.positions.map((position) => ({
      id: position.id,
      gardenId: garden.id,
      plotIndex: position.plotIndex,
      ticker: position.ticker,
      name: position.name,
      sector: position.sector,
      quantity: position.quantity,
      avgCost: position.avgCost,
      purchasedAt: position.purchasedAt,
    })),
  }));
}

export function mergeCbGardens(
  existing: StoredGarden[],
  seeded: StoredGarden[] = cbIssuanceGardens(),
): StoredGarden[] {
  const kept = existing.filter((garden) => !garden.id.startsWith("cb_"));
  return [...kept, ...seeded];
}

export function isGeneratedGarden(gardenId: string): boolean {
  return gardenId.startsWith("vc_") || gardenId.startsWith("cb_");
}
