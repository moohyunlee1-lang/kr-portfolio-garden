import { describe, expect, it } from "vitest";
import { sceneFogDistances } from "./scene-fog";

describe("large garden scene fog", () => {
  it("keeps a fitted 900-tree island inside the visible fog distance", () => {
    const [near, far] = sceneFogDistances(75);
    expect(near).toBeGreaterThan(36);
    expect(far).toBeGreaterThan(near);
    expect(sceneFogDistances(10)).toEqual([18, 36]);
  });
});