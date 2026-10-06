import { describe, expect, it } from "vitest";
import { crossMarkerAppearance } from "./cross-marker";

describe("cross marker appearance", () => {
  it("renders a golden star and a dead-cross skull independently of monthly range", () => {
    expect(crossMarkerAppearance("golden")?.shape).toBe("star");
    expect(crossMarkerAppearance("dead")?.shape).toBe("skull");
    expect(crossMarkerAppearance(null)).toBeNull();
  });
});
