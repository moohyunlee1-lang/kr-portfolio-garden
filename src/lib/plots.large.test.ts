import { describe, expect, it } from "vitest";
import { layoutFor } from "./plots";

describe("large generated garden layout", () => {
  it("fits hundreds of signal trees on a roughly square island", () => {
    const layout = layoutFor(933);
    expect(layout.count).toBeGreaterThanOrEqual(933);
    expect(layout.cols).toBeGreaterThan(20);
    expect(Math.abs(layout.cols - layout.rows)).toBeLessThanOrEqual(1);
    expect(layoutFor(69).cols).toBe(4);
  });
});