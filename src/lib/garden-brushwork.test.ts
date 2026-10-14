import { describe, it, expect } from "vitest";
import { groundPigment, meadowInstances } from "./garden-brushwork";

describe("original bounded garden brushwork", () => {
  it("makes repeatable non-flat opaque pigment without external assets", () => {
    const a = groundPigment(64);
    expect(a).toEqual(groundPigment(64));
    expect(a.length).toBe(64 * 64 * 4);
    expect(new Set(Array.from(a).filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(16);
    for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
  });
  it("bounds meadow cost independently of tree count and leaves the grid clear", () => {
    for (const radius of [7, 52]) {
      const items = meadowInstances(radius);
      expect(items).toEqual(meadowInstances(radius));
      expect(items.length).toBe(360);
      for (const p of items) {
        expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(radius - 0.5);
        expect(Math.hypot(p.x, p.z)).toBeLessThan(radius - 0.06);
        expect(p.height).toBeGreaterThan(0);
      }
    }
  });
});
