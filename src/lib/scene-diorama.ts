import { CELL, type PlotLayout } from "./plots";

/** Geometry only: never derives decorative color from portfolio performance. */
export function islandProfile(layout: PlotLayout) {
  const radius = Math.hypot(layout.cols * CELL / 2, layout.rows * CELL / 2) + 0.6;
  return { radius, fenceRadius: radius - 0.3, depth: Math.min(6, Math.max(1.8, radius * 0.28)) };
}

/** Fit by the limiting field of view, not a fixed distance that crops mobile. */
export function overviewPose(radius: number, aspect: number) {
  const halfFov = Math.atan(Math.tan(42 * Math.PI / 360) * Math.min(1, Math.max(0.2, aspect)));
  const distance = radius * 1.16 / Math.sin(halfFov);
  const target: [number, number, number] = [0, radius * 0.12, 0];
  const direction = [0.32, 0.68, 1];
  const length = Math.hypot(...direction);
  const position = direction.map((v, i) => v / length * distance + target[i]) as [number, number, number];
  return { position, target, distance };
}
