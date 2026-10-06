/** Scale fog to the fitted island rather than hiding large gardens entirely. */
export function sceneFogDistances(span: number): [number, number] {
  return [Math.max(18, span * 0.9), Math.max(36, span * 2.3)];
}
