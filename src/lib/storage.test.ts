import { describe, expect, it } from "vitest";
import {
  GARDENS_KEY,
  applyHidden,
  dropGarden,
  ensureEntry,
  loadGardens,
  saveHidden,
} from "./storage";
import { LAST_GARDEN_KEY } from "./garden-math";
import { mergeValueChainGardens } from "./valuechain-seed";

function memoryStorage() {
  const saved = new Map<string, string>();
  return {
    saved,
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
  };
}

describe("ensureEntry", () => {
  it("creates one empty garden and enters it when nothing is saved", () => {
    const storage = memoryStorage();
    const first = ensureEntry(storage, () => "garden-empty");
    expect(first.gardenId).toBe("garden-empty");
    expect(first.gardens[0].name).toBe("나의 정원");
    expect(first.gardens[0].positions).toEqual([]);
    expect(first.gardens.length).toBeGreaterThan(130);
    expect(first.gardens.filter((garden) => garden.group === "반도체").length).toBe(10);
    expect(first.gardens.filter((garden) => garden.group === "대기업·금융그룹").length).toBeGreaterThanOrEqual(80);
    expect(storage.getItem(LAST_GARDEN_KEY)).toBe("garden-empty");

    const second = ensureEntry(storage, () => "should-not-create");
    expect(second.gardenId).toBe("garden-empty");
    expect(loadGardens(storage).length).toBe(first.gardens.length);
    expect(storage.saved.get(GARDENS_KEY)).toBeTruthy();
  });

  it("returns the last garden instead of creating another", () => {
    const storage = memoryStorage();
    storage.setItem(
      GARDENS_KEY,
      JSON.stringify([
        { id: "a", name: "가", positions: [] },
        { id: "b", name: "나", positions: [] },
      ]),
    );
    storage.setItem(LAST_GARDEN_KEY, "b");
    const entry = ensureEntry(storage, () => "new");
    expect(entry.gardenId).toBe("b");
    expect(entry.gardens.length).toBeGreaterThan(130);
    expect(entry.gardens.map((garden) => garden.id).slice(0, 2)).toEqual(["a", "b"]);
  });

  it("does not restore a hidden value-chain garden", () => {
    const storage = memoryStorage();
    const seeded = mergeValueChainGardens([{ id: "mine", name: "내 밭", positions: [] }]);
    const hide = seeded.find((garden) => garden.id.startsWith("vc_"));
    expect(hide).toBeTruthy();
    storage.setItem(GARDENS_KEY, JSON.stringify(seeded));
    saveHidden(storage, [hide!.id]);
    storage.setItem(LAST_GARDEN_KEY, "mine");
    const entry = ensureEntry(storage, () => "new");
    expect(entry.gardens.some((garden) => garden.id === hide!.id)).toBe(false);
    expect(entry.gardens.some((garden) => garden.id === "mine")).toBe(true);
  });
});

describe("dropGarden", () => {
  it("removes the garden and points at the next one", () => {
    const result = dropGarden(
      [
        { id: "a", name: "가", positions: [] },
        { id: "b", name: "나", positions: [] },
      ],
      "a",
    );
    expect(result).toEqual({
      gardens: [{ id: "b", name: "나", positions: [] }],
      nextId: "b",
      hidden: false,
    });
  });

  it("marks generated garden ids as hidden", () => {
    const result = dropGarden(
      [
        { id: "mine", name: "내 밭", positions: [] },
        { id: "vc_semiconductor-sobujang_01", name: "소부장", positions: [] },
        { id: "cb_kospi", name: "코스피", positions: [] },
        { id: "grp_naver_096", name: "삼성그룹", positions: [] },
      ],
      "grp_naver_096",
    );
    expect(result?.hidden).toBe(true);
    expect(result?.gardens.map((garden) => garden.id)).toEqual([
      "mine",
      "vc_semiconductor-sobujang_01",
      "cb_kospi",
    ]);
  });

  it("refuses to drop the last garden", () => {
    expect(dropGarden([{ id: "a", name: "가", positions: [] }], "a")).toBeNull();
  });
});

describe("applyHidden", () => {
  it("filters hidden ids", () => {
    expect(
      applyHidden(
        [
          { id: "a", name: "가", positions: [] },
          { id: "b", name: "나", positions: [] },
        ],
        ["b"],
      ).map((garden) => garden.id),
    ).toEqual(["a"]);
  });
});

