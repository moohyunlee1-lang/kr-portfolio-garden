import { expect, it } from "vitest";
import { buildDashboard } from "./dashboard";
import {
  reportSections,
  reportMarkdown,
  reportPages,
} from "./dashboard-report";
import type { Research } from "./dashboard-research";
import type { Garden, Position } from "./types";
const positions = Array.from(
  { length: 75 },
  (_, i) =>
    ({
      ticker: String(i),
      name: `종목${i}`,
      sector: "반도체",
      quantity: 10,
      avgCost: 100,
      lastPrice: 100 + i,
    }) as Position,
);
const d = buildDashboard(
  { id: "g", name: "한국 정원", positions } as Garden,
  Object.fromEntries(positions.map((p) => [p.ticker, "반도체"])),
  "2026-10-09T00:00:00Z",
);
it("exports every selected sector stock in both sorted sections across pages", () => {
  const sections = reportSections(d, "반도체", undefined, "시세 기준 안내");
  const pages = reportPages(sections);
  expect(pages.length).toBeGreaterThan(10);
  const md = reportMarkdown(d, sections);
  expect(md).toContain("종목74");
  expect(md).toContain("종목0");
  expect(md).toContain("시세 기준 안내");
  expect(md).toContain("억원");
  expect(
    sections.find((s) => s.title.includes("종목 비중"))?.rows,
  ).toHaveLength(75);
  expect(
    sections.find((s) => s.title.includes("종목 수익률"))?.rows,
  ).toHaveLength(75);
  expect(pages.flatMap((p) => p.rows).length).toBe(
    sections.flatMap((p) => p.rows).length,
  );
});
it("distinguishes 20 unknown tickers from 21 fetched records in a 41-stock export", () => {
  const subset = positions.slice(0, 41);
  const dashboard = buildDashboard(
    { id: "g", name: "partial", positions: subset },
    Object.fromEntries(subset.map((p) => [p.ticker, "반도체"])),
    "now",
  );
  const research: Research = {
    generatedAt: "snapshot",
    fetchedAt: "now",
    sources: [],
    policy: "test",
    stocks: [...subset.slice(0, 20), subset[40]].map((p) => ({
      ticker: p.ticker,
      disclosures: [],
      news: [],
      newsStatus: "empty",
    })),
  };
  const sections = reportSections(dashboard, "반도체", research);
  const records = sections.filter((s) => s.title.startsWith("공시·뉴스 ·"));
  expect(records).toHaveLength(41);
  expect(
    records.filter((s) => s.rows[0].text.includes("게시 스냅샷에 기록 없음")),
  ).toHaveLength(21);
  expect(
    records.filter((s) => s.rows[0].text === "공시: 미조회/조회실패"),
  ).toHaveLength(20);
  const md = reportMarkdown(dashboard, sections);
  expect(md).toContain("종목20 (20)");
  expect(md).toContain("미조회/조회실패");
  const absent = reportSections(dashboard, "반도체");
  expect(
    absent
      .flatMap((s) => s.rows)
      .some((r) => r.text.includes("게시 스냅샷에 기록 없음")),
  ).toBe(false);
});
it("keeps full selected financial rows and parent scope with sector-denominator weights", () => {
  const dashboard = buildDashboard({id: "g", name: "부모", positions: [
    {ticker: "A", name: "A", quantity: 2, avgCost: 100000000, lastPrice: 200000000},
    {ticker: "B", name: "B", quantity: 1, avgCost: 100000000, lastPrice: 100000000},
    {ticker: "C", name: "C", quantity: 5, avgCost: 100000000, lastPrice: 100000000},
  ] as Position[]}, {A: "선택", B: "선택", C: "제외"}, "now");
  const sections = reportSections(dashboard, "선택");
  const full = sections.find(s => s.title === "전체 종목 상세");
  expect(full?.rows).toHaveLength(2);
  expect(full?.rows[0].text).toContain("수량 2 · 원금 2.00억원 · 평가액 4.00억원 · 섹터 내 비중 +80.00%");
  expect(sections[0].rows.some(r => r.text.includes("부모 정원 부모 · 정원 내 비중 +50.00%"))).toBe(true);
});
it("overview explains no duplicate ranks and excludes nothing from sectors", () => {
  const sections = reportSections(d, undefined, undefined, "기준");
  expect(sections.find((s) => s.title.includes("상위"))?.rows).toHaveLength(60);
  expect(reportMarkdown(d, sections)).toContain("중복 없이");
  const full = sections.find((s) => s.title === "전체 종목 상세");
  expect(full?.rows).toHaveLength(75);
  for (const p of positions)
    expect(reportMarkdown(d, sections)).toContain(`${p.name} (${p.ticker})`);
});
