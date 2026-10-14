import { expect, it } from "vitest";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { fitFocusBounds, focusSafeRect } from "./scene-focus";

it("uses measured canvas-relative HUD and bottom controls, not a device breakpoint", () => {
  expect(focusSafeRect({ left: 40, top: 20, right: 1160, bottom: 1020 },
    { left: 216, top: 32, right: 984, bottom: 274 },
    { left: 64, top: 930, right: 260, bottom: 996 })).toEqual({ left: 16, top: 270, right: 1104, bottom: 894 });
});

it("fits the full tall tree and fire in the actual mobile HUD-safe rectangle", () => {
  const bounds = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 5.4, 1));
  const viewport = { width: 390, height: 844 };
  const safe = { left: 16, top: 339, right: 374, bottom: 680 };
  const direction = new Vector3(0, 0.6, 0.8);
  const pose = fitFocusBounds(bounds, direction, viewport, safe, 42);
  const camera = new PerspectiveCamera(42, viewport.width / viewport.height, 0.1, 1000);
  camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld();
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const p = new Vector3(x, y, z).project(camera);
    const px = (p.x + 1) * viewport.width / 2, py = (1 - p.y) * viewport.height / 2;
    expect(px).toBeGreaterThanOrEqual(safe.left - 0.01); expect(px).toBeLessThanOrEqual(safe.right + 0.01);
    expect(py).toBeGreaterThanOrEqual(safe.top - 0.01); expect(py).toBeLessThanOrEqual(safe.bottom + 0.01);
  }
  expect(pose.position.clone().sub(pose.target).normalize().angleTo(direction)).toBeCloseTo(0);
});
