import { describe, expect, it } from "vitest";
import { groupGardens, mergeGroupGardens } from "./group-seed";
import report from "../data/group-gardens-report.json";

const REQUIRED_GROUPS = [
  "삼성",
  "SK",
  "현대자동차",
  "LG",
  "두산",
  "카카오",
  "LS",
  "KB금융",
  "신한금융",
  "하나금융",
  "우리금융",
  "BNK금융",
  "iM금융",
  "JB금융",
  "메리츠금융",
  "한국투자금융",
  "HMM",
  "현대해상",
  "NAVER",
  "S-Oil",
  "HDC",
];

describe("group gardens", () => {
  const gardens = groupGardens();

  it("includes the major conglomerates and financial groups", () => {
    const names = new Set(gardens.map((garden) => garden.name.replace(/그룹$/, "")));
    for (const name of REQUIRED_GROUPS) expect(names.has(name), name).toBe(true);
  });

  it("reports authoritative source coverage and explicit supplements", () => {
    expect(report.sourceGroupCount).toBe(102);
    expect(report.omittedGroups).toBeInstanceOf(Array);
    expect(report.explicitSupplements).toContain("KB금융");
  });

  it("contains one generated garden per group with valid listed positions", () => {
    expect(gardens.length).toBeGreaterThanOrEqual(80);
    expect(gardens.every((garden) => garden.id.startsWith("grp_"))).toBe(true);
    expect(gardens.every((garden) => garden.group === "대기업·금융그룹")).toBe(true);
    for (const garden of gardens) {
      expect(garden.positions.length, garden.name).toBeGreaterThan(0);
      expect(new Set(garden.positions.map((position) => position.ticker)).size).toBe(
        garden.positions.length,
      );
      for (const position of garden.positions) {
        expect(position.ticker).toMatch(/^[0-9A-Z]{6}$/);
        expect(position.quantity).toBeGreaterThan(0);
        expect(position.avgCost).toBeGreaterThan(0);
      }
    }
  });

  it("keeps reviewed FTC/Naver alias groups and their listed companies", () => {
    const tickersByName = new Map(
      gardens.map((garden) => [
        garden.name.replace(/그룹$/, ""),
        new Set(garden.positions.map((position) => position.ticker)),
      ]),
    );
    expect(tickersByName.get("HMM")).toContain("011200");
    expect(tickersByName.get("현대해상")).toContain("001450");
    expect(tickersByName.get("NAVER")).toContain("035420");
    expect(tickersByName.get("S-Oil")).toContain("010950");
    expect(tickersByName.get("HDC")).toContain("012630");
  });

  it("replaces generated group gardens without duplicating user gardens", () => {
    const mine = { id: "mine", name: "내 정원", positions: [] };
    const once = mergeGroupGardens([mine]);
    const twice = mergeGroupGardens(once);
    expect(twice.filter((garden) => garden.id.startsWith("grp_"))).toHaveLength(gardens.length);
    expect(twice.filter((garden) => garden.id === "mine")).toHaveLength(1);
  });
});
