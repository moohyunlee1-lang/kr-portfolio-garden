import type { Position } from "./types";

export const TREE_LIST_PAGE_SIZE = 60;

/** A compact inventory of the current garden, ordered by plot, not market rank. */
export function filterTreeList(positions: Position[], query: string): Position[] {
  const needle = query.trim().toLocaleLowerCase();
  return positions
    .filter((tree) => !needle || tree.name.toLocaleLowerCase().includes(needle) || tree.ticker.toLocaleLowerCase().includes(needle))
    .slice()
    .sort((a, b) => a.plotIndex - b.plotIndex || a.ticker.localeCompare(b.ticker));
}

export function treeListPage(positions: Position[], page: number): Position[] {
  return positions.slice(0, Math.max(1, Math.floor(page)) * TREE_LIST_PAGE_SIZE);
}
