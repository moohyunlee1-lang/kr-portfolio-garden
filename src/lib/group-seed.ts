import type { StoredGarden, StoredPosition } from "./types";
import raw from "../data/group-gardens.generated.json";

type RawGarden = {
  id: string;
  name: string;
  sectorName: string;
  positions: Array<Omit<StoredPosition, "gardenId"> & { gardenId?: string }>;
};

export function groupGardens(): StoredGarden[] {
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

export function mergeGroupGardens(
  existing: StoredGarden[],
  seeded: StoredGarden[] = groupGardens(),
): StoredGarden[] {
  const kept = existing.filter((garden) => !garden.id.startsWith("grp_"));
  return [...kept, ...seeded];
}
