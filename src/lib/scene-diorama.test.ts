import { describe, expect, it } from "vitest";
import { islandProfile, overviewPose } from "./scene-diorama";
import { CELL, layoutFor, plotPosition } from "./plots";

describe("floating island footprint", () => {
  it("fits the entire island on narrow mobile and desktop without going under the ground", () => {
    for (const n of [16, 900]) {
      const { radius } = islandProfile(layoutFor(n));
      for (const aspect of [0.46, 1.4]) {
        const pose = overviewPose(radius, aspect);
        const distance = Math.hypot(...pose.position.map((v, i) => v - pose.target[i]));
        const halfFov = Math.atan(Math.tan(42 * Math.PI / 360) * Math.min(1, aspect));
        expect(distance * Math.sin(halfFov)).toBeGreaterThan(radius);
        expect(pose.position[1]).toBeGreaterThan(0);
      }
      expect(overviewPose(radius, 0.46).distance).toBeGreaterThan(overviewPose(radius, 1.4).distance);
    }
  });
  it("supports every corner bed including large square gardens with a grass margin", () => {
    for (const n of [0, 16, 60, 900]) {
      const layout = layoutFor(n);
      const island = islandProfile(layout);
      for (const index of [0, layout.count - 1]) {
        const [x, , z] = plotPosition(index, layout.cols, layout.rows);
        const bedCorner = Math.hypot(Math.abs(x) + CELL / 2, Math.abs(z) + CELL / 2);
        expect(island.radius).toBeGreaterThan(bedCorner);
        expect(island.fenceRadius).toBeGreaterThan(bedCorner);
        expect(island.fenceRadius).toBeLessThan(island.radius);
      }
      expect(island.depth).toBeGreaterThanOrEqual(1.8);
      expect(island.depth).toBeLessThanOrEqual(6);
    }
  });
});
