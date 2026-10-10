import { expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildDashboard } from "./dashboard";
import { representativeIndustries, industryRecords } from "./representative-industry";
import { quoteRecord } from "./quotes";
import seeds from "../data/cross-garden.generated.json";
import canonical from "../data/canonical-sectors.generated.json";
import { reportSections } from "./dashboard-report";
import type { Garden, Position } from "./types";

const quotes = quoteRecord();
const garden: Garden = {
  ...seeds[0],
  positions: seeds[0].positions.map(p => ({ ...p, lastPrice: quotes[p.ticker]?.lastPrice } as Position)),
};
it("preserves exact CROSS count, costs, prices, gains, returns and full weight mass", () => {
  const before = JSON.stringify(garden);
  const old = buildDashboard(garden, canonical, "fixed");
  const next = buildDashboard(garden, representativeIndustries, "fixed");
  expect(next.stocks).toHaveLength(933);
  expect(old.stocks.filter(s => s.sector === "기타")).toHaveLength(425);
  for (const key of ["cost", "marketValue", "profit", "returnPct"] as const)
    expect(next[key]).toBe(old[key]);
  expect(next.stocks.map(row => ({ ...row, sector: undefined })))
    .toEqual(old.stocks.map(row => ({ ...row, sector: undefined })));
  expect(next.sectors.reduce((sum,s) => sum + (s.weightPct ?? 0), 0)).toBeCloseTo(100, 10);
  expect(JSON.stringify(garden)).toBe(before);
  expect(industryRecords["005930"].themes).toEqual(["로봇", "바이오", "자동차"]); // Existing garden membership, not canonical theme override.
  expect(representativeIndustries["005930"]).toBe("전자부품·통신장비");
  if (process.env.INDUSTRY_AUDIT_DIR) {
    mkdirSync(process.env.INDUSTRY_AUDIT_DIR, { recursive: true });
    writeFileSync(`${process.env.INDUSTRY_AUDIT_DIR}/invariants.json`, JSON.stringify({ old, next, invariant: "Exact totals and all stock financial values equal; sectors sum to 100%", appQuotes: Object.values(quotes).map(q => ({ ticker: q.ticker, name: q.name, oldSector: q.sector })) }, null, 2));
  }
});
it("exports per-stock classification source, raw subsector, status and themes in complete Markdown sections", () => {
  const dashboard = buildDashboard(garden, representativeIndustries, "fixed");
  const section = reportSections(dashboard).find(s => s.title === "대표업종 분류 근거 · 전체 종목");
  expect(section?.rows).toHaveLength(933);
  expect(section?.rows.every(r => r.url?.startsWith("https://kind.krx.co.kr/"))).toBe(true);
  expect(section?.rows[0].text).toContain("수집");
  expect(section?.rows[0].text).toContain("테마");
});
