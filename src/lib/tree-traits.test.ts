import { describe, expect, it } from "vitest";
import { TREE_TRAIT_RULES, classifyTree } from "./tree-traits";

describe("classifyTree", () => {
  it("maps market cap to small / mid / large", () => {
    expect(classifyTree({ marketCap: 100_000_000_000 }).size).toBe("small");
    expect(classifyTree({ marketCap: TREE_TRAIT_RULES.marketCap.midAt }).size).toBe("mid");
    expect(classifyTree({ marketCap: TREE_TRAIT_RULES.marketCap.largeAt }).size).toBe("large");
    expect(classifyTree({}).size).toBe("mid");
  });

  it("uses dark leaves when EPS is negative", () => {
    expect(classifyTree({ eps: -12 }).tone).toBe("dark");
    expect(classifyTree({ eps: 0 }).tone).toBe("bright");
    expect(classifyTree({ eps: 167 }).tone).toBe("bright");
  });

  it("uses fewer leaves when debt ratio is high", () => {
    expect(classifyTree({ debtRatioPct: 20 }).foliage).toBe("dense");
    expect(classifyTree({ debtRatioPct: 80 }).foliage).toBe("medium");
    expect(classifyTree({ debtRatioPct: 171 }).foliage).toBe("sparse");
  });
});
