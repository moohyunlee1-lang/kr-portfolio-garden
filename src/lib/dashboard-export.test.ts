import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import JSZip from "jszip";
import { exportReport, summaryLayout } from "./dashboard-export";
import { buildDashboard } from "./dashboard";
import { reportSections } from "./dashboard-report";
import type { Position } from "./types";
it("shows full top/bottom 30 names in a financial report, with honest stock-only scope", () => {
  const positions = Array.from(
    { length: 65 },
    (_, i) =>
      ({
        ticker: String(i),
        name: `검증종목전체이름${i}`,
        quantity: 1,
        avgCost: 100,
        lastPrice: 50 + i * 2,
      }) as Position,
  );
  const d = buildDashboard(
    { id: "g", name: "합성 fixture", positions },
    {},
    "now",
  );
  const scene = summaryLayout(d, reportSections(d));
  const content = scene.texts.map((t) => t.text).join(" ").replace(/\n/g, "");
  const names = scene.texts.filter((t) => t.y > 9 && t.text.startsWith("검증종목"));
  expect(names).toHaveLength(60);
  expect(names.every((t) => t.size >= 16)).toBe(true);
  expect(scene.texts.find((t) => t.text === "미분류·검토 필요")!.size).toBeGreaterThanOrEqual(18);
  for (const t of scene.texts)
    expect(t.text.split("\n").length * t.size / 72 * 1.18).toBeLessThanOrEqual(t.h);
  expect(content).toContain("국내 주식 포트폴리오 섹터 분석");
  expect(content).toContain("비주식 자산 미입력");
  for (const i of [
    ...Array.from({ length: 30 }, (_, i) => i),
    ...Array.from({ length: 30 }, (_, i) => 35 + i),
  ])
    expect(content).toContain(`검증종목전체이름${i}`);
  expect(content).toContain("BOTTOM 30");
});
it("uses a shared linear diverging scale with an explicit zero axis", () => {
  const positions = [50, 125, 150].map(
    (lastPrice, i) =>
      ({
        ticker: String(i),
        name: `종목${i}`,
        quantity: 1,
        avgCost: 100,
        lastPrice,
      }) as Position,
  );
  const d = buildDashboard(
    { id: "g", name: "mixed fixture", positions },
    { "0": "A", "1": "B", "2": "C" },
    "now",
  );
  const scene = summaryLayout(d, reportSections(d));
  const axis = scene.cards.find((c) => c.color === "AEB7C2")!;
  const bars = scene.cards.filter(
    (c) => ["297258", "AB4D59"].includes(c.color ?? "") && c.y < 7,
  );
  expect(bars).toHaveLength(3);
  expect(bars[0].w).toBeCloseTo(bars[1].w * 2);
  expect(bars[2].x + bars[2].w).toBeCloseTo(axis.x);
  expect(bars[0].x).toBeCloseTo(axis.x);
  expect(bars[2].w).toBeCloseTo(bars[0].w);
});
it("preserves long names and unknown values while partitioning a small universe honestly", () => {
  const positions = [
    {
      ticker: "A",
      name: "에이치디한국조선해양우선주",
      quantity: 1,
      avgCost: 100,
      lastPrice: 50,
    },
    {
      ticker: "B",
      name: "알려진종목",
      quantity: 1,
      avgCost: 100,
      lastPrice: 200,
    },
    {
      ticker: "C",
      name: "가격미확인",
      quantity: 1,
      avgCost: 100,
      lastPrice: 0,
    },
    { ticker: "D", name: "원금영", quantity: 1, avgCost: 0, lastPrice: 200 },
  ] as Position[];
  const d = buildDashboard(
    { id: "g", name: "unknown fixture", positions },
    {},
    "now",
  );
  const scene = summaryLayout(d, reportSections(d)),
    content = scene.texts
      .map((t) => t.text)
      .join(" ")
      .replace(/\n/g, "");
  expect(content).toContain("에이치디한국조선해양우선주");
  expect(content).toContain("TOP 1");
  expect(content).toContain("BOTTOM 1");
  expect(content).toContain("순위 확인 2/4종목");
  expect(scene.texts.filter((t) => t.text === "—").length).toBeGreaterThan(2);
  for (const t of scene.texts)
    expect(
      ((t.text.split("\n").length * t.size) / 72) * 1.18,
    ).toBeLessThanOrEqual(t.h);
});
it("prioritizes every stock's disclosures before any news in the six linked summaries", () => {
  const positions = Array.from({ length: 4 }, (_, i) => ({ ticker: String(i), name: `종목${i}`, quantity: 1, avgCost: 100, lastPrice: 100 }) as Position);
  const d = buildDashboard({ id: "g", name: "정원", positions }, Object.fromEntries(positions.map(p => [p.ticker, "업종"])), "now");
  const sections = reportSections(d, "업종", {
    generatedAt: "2026-10-09", fetchedAt: "2026-10-09", sources: [], policy: "fixture",
    stocks: positions.map(p => ({ ticker: p.ticker, newsStatus: "ok", disclosures: [{type: "disclosure", title: "공시", publishedAt: "2026-05-22", source: "DART", url: `https://example.com/disclosure/${p.ticker}`}], news: Array.from({length:3}, (_, i) => ({type: "news", title: "뉴스", publishedAt: "2026-10-09", source: "뉴스사", url: `https://example.com/news/${p.ticker}/${i}`})) }))
  });
  const links = summaryLayout(d, sections).texts.filter(t => t.url);
  expect(links.slice(0,4).map(t => t.url)).toEqual(positions.map(p => `https://example.com/disclosure/${p.ticker}`));
  expect(links).toHaveLength(6);
});
it("fits full sector stock names and shows sector-only metrics, parent weight, amounts and dated provenance", () => {
  const positions = Array.from({length: 9}, (_, i) => ({ ticker: String(i), name: `에이치디한국조선해양우선주${i}`, quantity: 1, avgCost: 100000000, lastPrice: (i + 1) * 100000000 }) as Position);
  const d = buildDashboard({id: "g", name: "부모 정원", positions}, Object.fromEntries(positions.map(p => [p.ticker, p.ticker === "8" ? "다른 업종" : "선택 업종"])), "now");
  const sections = reportSections(d, "선택 업종");
  sections.find(s => s.title === "공시·뉴스 출처와 한계")!.rows = [{text: "공시 스냅샷 생성 2026-10-09 · 뉴스 조회 2026-10-09"}, {text: "DB · DB 최신 공시일 2026-05-22 · 확인 100건"}];
  const scene = summaryLayout(d, sections);
  const content = scene.texts.map(t => t.text).join(" ").replace(/\n/g, "");
  expect(content).toContain("정원 내 비중 80.00%");
  expect(content).toContain("섹터 내 평가액 기준");
  expect(content).toContain("36.00억원");
  expect(content).toContain("과거 공시");
  expect(content).toContain("2026-05-22");
  expect(content).toContain("공시 우선");
  const axisLabel = scene.texts.find(t => t.text === "0")!;
  const chartCaption = scene.texts.find(t => t.text.startsWith("손익 합계"))!;
  expect(axisLabel.y + axisLabel.h).toBeLessThanOrEqual(chartCaption.y);
  expect(scene.texts.filter(t => t.x > 17 && t.y > 3 && t.y < 9 && t.text.endsWith("억원"))).toHaveLength(8);
  for (const t of scene.texts) expect(t.text.split("\n").length * t.size / 72 * 1.18).toBeLessThanOrEqual(t.h);
});
it("offers a PNG export through the actual browser controls", () => {
  expect(readFileSync("src/components/garden-dashboard.tsx", "utf8")).toContain(
    '["pdf", "pptx", "png", "md"]',
  );
});
it("bounds stalled font fetches at 15 seconds and allows a subsequent retry", async () => {
  vi.useFakeTimers();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(
      () =>
        controller.abort(new DOMException("Font timed out", "TimeoutError")),
      ms,
    );
    return controller.signal;
  });
  const request = vi.fn(
    (_url: string, options?: RequestInit) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(options.signal!.reason),
          { once: true },
        );
      }),
  );
  vi.stubGlobal("fetch", request);
  const d = buildDashboard(
    { id: "g", name: "timeout", positions: [] },
    {},
    "now",
  );
  const pending = exportReport("pdf", d, reportSections(d));
  const rejected = expect(pending).rejects.toThrow("Font timed out");
  await vi.waitFor(() => expect(request).toHaveBeenCalled());
  expect(timeout).toHaveBeenCalledWith(15000);
  expect(request.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  await vi.advanceTimersByTimeAsync(15000);
  await rejected;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () =>
        readFileSync("public/fonts/NotoSansKR-Regular.ttf"),
    }),
  );
  const retry = await exportReport("pdf", d, reportSections(d));
  expect(retry.type).toBe("application/pdf");
});
it("keeps only the third footer explanation and retains provenance in Markdown", async () => {
  const d = buildDashboard({ id: "g", name: "g", positions: [] }, {}, "now");
  const sections = reportSections(d);
  sections.push({
    title: "공시·뉴스 출처와 한계",
    rows: [
      {
        text: "공시 스냅샷 생성 2026-10-09T01:25:25.000Z · 뉴스 조회 2026-10-09T03:00:00Z",
      },
      {
        text:
          "very long database provenance ".repeat(10) +
          " · DB 최신 공시일 2026-05-22 · 확인 100건",
      },
      { text: "second database · DB 최신 공시일 2026-05-14 · 확인 20건" },
    ],
  });
  const rendered = summaryLayout(d, sections)
    .texts.map((t) => t.text)
    .join(" ");
  expect(rendered).not.toContain("2026-05-22");
  const footer = summaryLayout(d, sections).texts.filter((t) => t.y >= 14);
  expect(footer.map((t) => t.text)).toEqual([
    "수익률: 매수원금 대비 · 배당·수수료·세금 제외 · 억원/수익률 소수 둘째 자리 반올림 · 비주식 미수집",
  ]);
  expect(rendered).not.toContain("한 장 요약");
  expect(rendered).not.toContain("생성 시각 ≠ 거래 시각");
  const markdown = await (await exportReport("md", d, sections)).text();
  expect(markdown).toContain("2026-05-22");
  expect(markdown).toContain("2026-05-14");
});
it("generates one landscape PDF and widescreen slide for large overview and sector fixtures", async () => {
  const positions = Array.from(
    { length: 65 },
    (_, i) =>
      ({
        ticker: String(i),
        name: `삼성전자${i}`,
        quantity: 100,
        avgCost: 100000,
        lastPrice: 50000 + i * 2500,
      }) as Position,
  );
  for (const scope of ["overview", "sector"]) {
    const d = buildDashboard(
      { id: "g", name: "합성 65종목 검증 정원", positions },
      Object.fromEntries(
        positions.map((p) => [
          p.ticker,
          scope === "sector" ? "반도체" : `섹터${p.ticker}`,
        ]),
      ),
      "2026-10-09T00:00:00Z",
    );
    d.stocks.forEach((stock) => { stock.name = `에이치디한국조선해양우선주${stock.ticker}`; });
    const sections = reportSections(
      d,
      scope === "sector" ? "반도체" : undefined,
      {
        generatedAt: "2026-05-22",
        fetchedAt: "2026-10-09",
        sources: [],
        policy: "합성 자료 검증용",
        stocks: positions.slice(0, 60).map((p) => ({
          ticker: p.ticker,
          newsStatus: "ok" as const,
          news: [],
          disclosures: [
            {
              type: "disclosure",
              title: "검증용 중요공시 제목 · 긴 문자열 확인 ".repeat(10),
              publishedAt: "2026-05-22",
              source: "DART 합성",
              url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260522000001`,
            },
          ],
        })),
      },
      "시세 출처 테스트 · 가격 시각 미제공",
    );
    const scene = summaryLayout(d, sections);
    if (process.env.DASHBOARD_ARTIFACT_DIR) {
      mkdirSync(process.env.DASHBOARD_ARTIFACT_DIR, { recursive: true });
      writeFileSync(
        `${process.env.DASHBOARD_ARTIFACT_DIR}/${scope}.input.json`,
        JSON.stringify({ d, sections }),
      );
    }
    if (process.env.DASHBOARD_ARTIFACT_DIR) {
      mkdirSync(process.env.DASHBOARD_ARTIFACT_DIR, { recursive: true });
      writeFileSync(
        `${process.env.DASHBOARD_ARTIFACT_DIR}/${scope}.summary.json`,
        JSON.stringify(scene, null, 2),
      );
    }
    if (scope === "sector") {
      expect(scene.texts.filter((t) => t.url)).toHaveLength(6);
      expect(
        scene.texts
          .filter((t) => t.url)
          .every((t) => t.text.includes("DART 합성")),
      ).toBe(true);
      expect(scene.texts.some((t) => t.text.includes("6/60 표시"))).toBe(true);
      expect(scene.texts.some((t) => t.text.includes("5/65종목 미조회"))).toBe(
        true,
      );
    }
    for (const t of scene.texts) {
      expect(t.x + t.w).toBeLessThanOrEqual(scene.width);
      expect(t.y + t.h).toBeLessThanOrEqual(scene.height);
      expect(t.size).toBeGreaterThanOrEqual(10);
      expect(
        ((t.text.split("\n").length * t.size) / 72) * 1.18,
      ).toBeLessThanOrEqual(t.h);
    }
    expect(scene.texts.some((t) => t.text.includes("8/65 표시"))).toBe(true);
    const font = readFileSync("public/fonts/NotoSansKR-Regular.ttf").toString(
      "base64",
    );
    for (const format of ["pdf", "pptx", "md"] as const) {
      const file = await exportReport(format, d, sections, font);
      const bytes = Buffer.from(await file.arrayBuffer());
      expect(bytes.length).toBeGreaterThan(1000);
      if (format === "pdf") {
        expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
        expect(bytes.toString().match(/\/Type \/Page\b/g)!.length).toBe(1);
      }
      if (format === "pptx") {
        const zip = await JSZip.loadAsync(bytes);
        expect(
          Object.keys(zip.files).filter((n) =>
            /^ppt\/slides\/slide\d+\.xml$/.test(n),
          ),
        ).toHaveLength(1);
        expect(
          await zip.file("ppt/presentation.xml")!.async("string"),
        ).toContain('cx="24384000" cy="13716000"');
        expect(
          await zip.file("ppt/slides/slide1.xml")!.async("string"),
        ).toContain("MD");
      }
      if (format === "md") {
        expect(bytes.toString()).toContain("에이치디한국조선해양우선주64");
        if (scope === "sector")
          expect(bytes.toString().match(/\[원문\]\(/g)).toHaveLength(60);
      }
      if (process.env.DASHBOARD_ARTIFACT_DIR) {
        mkdirSync(process.env.DASHBOARD_ARTIFACT_DIR, { recursive: true });
        writeFileSync(
          `${process.env.DASHBOARD_ARTIFACT_DIR}/${scope}.${format}`,
          bytes,
        );
      }
    }
  }
}, 30000);
