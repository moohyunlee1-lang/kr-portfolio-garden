import raw from "../data/kosdaq-risk-garden.generated.json";
import type { StoredGarden, StoredPosition } from "./types";

const GARDEN_ID = "kosdaq_delisting_risk";

type RiskGarden = {
  id: string;
  name: string;
  sectorName: string;
  positions: Array<Omit<StoredPosition, "gardenId">>;
};

export function kosdaqRiskGardens(): StoredGarden[] {
  return (raw as RiskGarden[]).map((garden) => ({
    id: garden.id,
    name: garden.name,
    group: garden.sectorName,
    positions: garden.positions.map((position) => ({ ...position, gardenId: garden.id })),
  }));
}

export function mergeKosdaqRiskGardens(existing: StoredGarden[], seeded: StoredGarden[] = kosdaqRiskGardens()): StoredGarden[] {
  return [...existing.filter((garden) => garden.id !== GARDEN_ID), ...seeded];
}
