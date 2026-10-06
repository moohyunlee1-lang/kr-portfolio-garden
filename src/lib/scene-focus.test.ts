import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { focusCameraPose } from "./scene-focus";

const layout = { cols: 4, rows: 4, count: 16 };

describe("focused tree camera", () => {
  it("aims at the selected plot and moves the camera close while preserving view direction", () => {
    const camera = new Vector3(0, 20, 30);
    const orbitTarget = new Vector3(0, 0.35, 0);
    const pose = focusCameraPose(0, layout, camera, orbitTarget);
    expect(pose.target.toArray()).toEqual([-3.12, 0.85, -3.12]);
    expect(pose.position.distanceTo(pose.target)).toBeCloseTo(7);
    expect(pose.position.clone().sub(pose.target).normalize().angleTo(camera.clone().sub(orbitTarget))).toBeCloseTo(0);
    expect(camera.toArray()).toEqual([0, 20, 30]);
    expect(orbitTarget.toArray()).toEqual([0, 0.35, 0]);
  });

  it("uses the expanded layout coordinates for a tree far from the center", () => {
    const pose = focusCameraPose(117, { cols: 11, rows: 11, count: 121 }, new Vector3(5, 8, 15), new Vector3());
    expect(pose.target.x).toBeCloseTo(4.16);
    expect(pose.target.z).toBeCloseTo(10.4);
  });
});
