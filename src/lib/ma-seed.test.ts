import { describe, expect, it } from "vitest";
import { maGardens, mergeMaGardens } from "./ma-seed";
import { isGeneratedGarden } from "./cb-issuance-seed";
import type { StoredGarden } from "./types";

const monitor: StoredGarden = {
  id: "ma_watch", name: "라이딩트리", group: "이동평균선", positions: [],
};

describe("MA monitor garden", () => {
  it("replaces only its own generated garden and keeps user gardens", () => {
    const existing: StoredGarden[] = [
      { id: "mine", name: "나의 정원", positions: [] },
      { id: "ma_watch", name: "old", positions: [] },
      { id: "grp_ftc_001", name: "삼성", positions: [] },
    ];
    const merged = mergeMaGardens(existing, [monitor]);
    expect(merged.map((garden) => garden.id)).toEqual(["mine", "grp_ftc_001", "ma_watch"]);
    expect(merged.at(-1)?.name).toBe("라이딩트리");
    expect(maGardens()[0].name).toBe("라이딩트리");
    expect(isGeneratedGarden("ma_watch")).toBe(true);
  });
});
