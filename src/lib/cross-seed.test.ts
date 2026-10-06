import { describe, expect, it } from "vitest";
import { crossGardens, mergeCrossGardens, crossMark } from "./cross-seed";
import { isGeneratedGarden } from "./cb-issuance-seed";

const mine = { id: "mine", name: "내 정원", positions: [] };

describe("cross garden UI", () => {
  it("merges generated cross garden without changing other families", () => {
    const result = mergeCrossGardens([mine, { id: "cross_watch", name: "old", positions: [] }, { id: "ma_watch", name: "riding", positions: [] }]);
    expect(result.map((g) => g.id)).toEqual(["mine", "ma_watch", "cross_watch"]);
    expect(result.at(-1)?.name).toBe("크로스트리");
    expect(result.at(-1)?.positions).toEqual(crossGardens()[0].positions);
    expect(isGeneratedGarden("cross_watch")).toBe(true);
  });
  it("maps ticker marks independently of garden membership", () => {
    expect(crossMark("000001", { "000001": "golden", "000002": "dead" })).toBe("golden");
    expect(crossMark("000002", { "000001": "golden", "000002": "dead" })).toBe("dead");
    expect(crossMark("other", { "000001": "golden" })).toBeNull();
  });
});
