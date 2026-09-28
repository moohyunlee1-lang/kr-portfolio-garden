import { describe, expect, it } from "vitest";
import { GARDENS_KEY, ensureEntry, loadGardens } from "./storage";
import { LAST_GARDEN_KEY } from "./garden-math";

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
});
