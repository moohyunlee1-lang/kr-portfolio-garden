export const COLS = 4;
export const ROWS = 4;
export const CELL = 2.08;
export const BASE_PLOTS = COLS * ROWS;

export type PlotLayout = {
  cols: number;
  rows: number;
  count: number;
};

export function layoutFor(needed: number): PlotLayout {
  const size = Math.max(BASE_PLOTS, needed);
  const cols = size > 100 ? Math.ceil(Math.sqrt(size)) : COLS;
  const rows = Math.max(ROWS, Math.ceil(size / cols));
  return { cols, rows, count: cols * rows };
}

export function layoutFromPositions(positions: Array<{ plotIndex: number }>): PlotLayout {
  const needed = positions.reduce((max, item) => Math.max(max, item.plotIndex + 1), 0);
  return layoutFor(needed);
}

export function plotPosition(
  index: number,
  cols: number = COLS,
  rows: number = ROWS,
): [number, number, number] {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return [
    (col - (cols - 1) / 2) * CELL,
    0,
    (row - (rows - 1) / 2) * CELL,
  ];
}
