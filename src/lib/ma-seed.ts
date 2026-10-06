import type { StoredGarden, StoredPosition } from "./types";
import raw from "../data/ma-garden.generated.json";

type RawGarden = {
  id: string;
  name: string;
  sectorName: string;
  positions: Array<Omit<StoredPosition, "gardenId"> & { gardenId?: string }>;
};

export function maGardens(): StoredGarden[] {
  return (raw as RawGarden[]).map((garden) => ({
    id: garden.id,
    name: "라이딩트리",
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

export function mergeMaGardens(
  existing: StoredGarden[],
  seeded: StoredGarden[] = maGardens(),
): StoredGarden[] {
  return [...existing.filter((garden) => garden.id !== "ma_watch"), ...seeded];
}
