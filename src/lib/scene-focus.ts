import { Vector3 } from "three";
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
