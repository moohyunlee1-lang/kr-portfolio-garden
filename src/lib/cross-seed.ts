import raw from "../data/cross-garden.generated.json";
import marks from "../data/cross-marks.generated.json";
import type { StoredGarden, StoredPosition } from "./types";

export type CrossMark = "golden" | "dead";

export function crossMark(ticker: string, byTicker: Record<string, string> = marks): CrossMark | null {
  const kind = byTicker[ticker];
  return kind === "golden" || kind === "dead" ? kind : null;
}

export function crossGardens(): StoredGarden[] {
  return (raw as Array<{ id: string; name: string; sectorName: string; positions: Array<Omit<StoredPosition, "gardenId">> }>).map((garden) => ({
    id: garden.id, name: garden.name, group: garden.sectorName,
    positions: garden.positions.map((position) => ({ ...position, gardenId: garden.id })),
  }));
}

export function mergeCrossGardens(existing: StoredGarden[], seeded: StoredGarden[] = crossGardens()): StoredGarden[] {
  return [...existing.filter((garden) => garden.id !== "cross_watch"), ...seeded];
}
