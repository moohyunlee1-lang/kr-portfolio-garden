import { Box3, Vector3 } from "three";

export type FocusRect = { left: number; top: number; right: number; bottom: number };

/** Conservative clear strip between the actual HUD and navigation controls. */
export function focusSafeRect(canvas: FocusRect, hud?: FocusRect, controls?: FocusRect): FocusRect {
  return {
    left: 16,
    right: canvas.right - canvas.left - 16,
    top: Math.max(16, (hud?.bottom ?? canvas.top) - canvas.top + 16),
    bottom: Math.min(canvas.bottom, controls?.top ?? canvas.bottom) - canvas.top - 16,
  };
}

/** Fit world bounds to an off-centre DOM-safe viewport, preserving orbit direction.
 * Perspective inequalities include each corner's depth, not just a flat height estimate.
 */
export function fitFocusBounds(
  bounds: Box3,
  viewDirection: Vector3,
  viewport: { width: number; height: number },
  safe: FocusRect,
  fov: number,
): { target: Vector3; position: Vector3 } {
  const direction = viewDirection.clone().normalize();
  if (direction.lengthSq() === 0) direction.set(0, 0.6, 0.8);
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const tanY = Math.tan(fov * Math.PI / 360);
  const tanX = tanY * viewport.width / viewport.height;
  const left = (2 * safe.left / viewport.width - 1) * tanX;
  const rightEdge = (2 * safe.right / viewport.width - 1) * tanX;
  const bottom = (1 - 2 * safe.bottom / viewport.height) * tanY;
  const top = (1 - 2 * safe.top / viewport.height) * tanY;
  const shiftX = -(left + rightEdge) / 2;
  const shiftY = -(bottom + top) / 2;
  const center = bounds.getCenter(new Vector3());
  let distance = 3.2;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const p = new Vector3(x, y, z).sub(center);
    const px = p.dot(right), py = p.dot(up), depth = p.dot(direction);
    distance = Math.max(distance, depth + 0.1,
      (px + left * depth) / (shiftX + left),
      (px + rightEdge * depth) / (shiftX + rightEdge),
      (py + bottom * depth) / (shiftY + bottom),
      (py + top * depth) / (shiftY + top));
  }
  const target = center.addScaledVector(right, shiftX * distance).addScaledVector(up, shiftY * distance);
  return { target, position: target.clone().addScaledVector(direction, distance) };
}
import { plotPosition, type PlotLayout } from "./plots";

export function focusCameraPose(
  plotIndex: number,
  layout: PlotLayout,
  cameraPosition: Vector3,
  orbitTarget: Vector3,
): { target: Vector3; position: Vector3 } {
  const [x, , z] = plotPosition(plotIndex, layout.cols, layout.rows);
  const target = new Vector3(x, 0.85, z);
  const offset = cameraPosition.clone().sub(orbitTarget);
  if (offset.lengthSq() === 0) offset.set(0, 0.6, 0.8);
  return { target, position: target.clone().add(offset.setLength(7)) };
}
