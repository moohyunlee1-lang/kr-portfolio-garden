// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { exportReport } from "../lib/dashboard-export";
vi.mock("../lib/dashboard-export", () => ({ exportReport: vi.fn() }));
import { GardenDashboard } from "./garden-dashboard";
import type { Garden, Position } from "../lib/types";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const garden: Garden = {
  id: "g",
  name: "테스트 정원",
  positions: [
    {
      ticker: "005930",
      name: "삼성전자",
      quantity: 10,
      avgCost: 100,
      lastPrice: 150,
      sector: "간접",
      id: "p",
    } as Position,
  ],
};
it("groups by representative KIND industry, not canonical investment theme", () => {
  render(<GardenDashboard garden={garden} />);
  fireEvent.click(screen.getByRole("button", { name: "대시보드 생성하기" }));
  expect(screen.queryByRole("button", { name: "전자부품·통신장비 분석" })).not.toBeNull();
  expect(screen.queryByRole("button", { name: "반도체 분석" })).toBeNull();
  expect(garden.positions[0].sector).toBe("간접");
});
it("does not start analysis on load; captures on click, freezes rerenders, explicitly analyzes a sector", async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      generatedAt: "2026-05-22",
      fetchedAt: "now",
      sources: [],
      policy: "제한",
      stocks: [
        { ticker: "005930", disclosures: [], news: [], newsStatus: "empty" },
      ],
    }),
  });
  vi.stubGlobal("fetch", fetcher);
  const { rerender } = render(<GardenDashboard garden={garden} />);
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "대시보드 생성하기" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getAllByText("+50.00%").length).toBeGreaterThan(0);
  rerender(
    <GardenDashboard
      garden={{
        ...garden,
        positions: [{ ...garden.positions[0], lastPrice: 200 }],
      }}
    />,
  );
  expect(screen.getAllByText("+50.00%").length).toBeGreaterThan(0);
  expect(screen.getAllByText("+100.00%")).toHaveLength(1); // sector weight, not return
  fireEvent.click(screen.getByRole("button", { name: "전자부품·통신장비 분석" }));
  await waitFor(() => expect(screen.getByText(/API 결과 없음/)).toBeTruthy());
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.getByText("공시: 게시 스냅샷에 기록 없음 (공시가 없다는 뜻 아님)")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "다시 분석" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(
    screen.getByRole("heading", { name: /전자부품·통신장비 · 섹터 분석/ }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("does not download a late export after closing the dashboard", async () => {
  let resolve!: (blob: Blob) => void;
  vi.mocked(exportReport).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const createObjectURL = vi.fn().mockReturnValue("blob:test");
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
  render(<GardenDashboard garden={garden} />);
  fireEvent.click(screen.getByRole("button", { name: "대시보드 생성하기" }));
  fireEvent.click(screen.getByRole("button", { name: "PDF 가로 한 장 다운로드" }));
  await waitFor(() => expect(exportReport).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  resolve(new Blob(["test"]));
  await new Promise((r) => setTimeout(r, 30));
  expect(createObjectURL).not.toHaveBeenCalled();
});
it("paginates all 65 selected-sector holdings rather than truncating them", async () => {
  const positions = Array.from({ length: 65 }, (_, i) => ({
    ...garden.positions[0],
    id: `p${i}`,
    ticker: `Q${String(i).padStart(5, "0")}`,
    name: `검증종목${i}`,
    lastPrice: 150 + i,
  }));
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: "now",
          fetchedAt: "now",
          sources: [],
          policy: "test",
          stocks: [],
        }),
      }),
  );
  render(<GardenDashboard garden={{ ...garden, positions }} />);
  fireEvent.click(screen.getByRole("button", { name: "대시보드 생성하기" }));
  fireEvent.click(screen.getByRole("button", { name: "미분류·검토 필요 분석" }));
  const section = screen
    .getByRole("heading", { name: /종목 비중/ })
    .closest("section")!;
  expect(within(section).getAllByText(/검증종목/)).toHaveLength(30);
  fireEvent.click(
    within(section).getByRole("button", { name: "종목 비중 다음" }),
  );
  expect(within(section).getAllByText(/검증종목/)).toHaveLength(30);
  fireEvent.click(
    within(section).getByRole("button", { name: "종목 비중 다음" }),
  );
  expect(within(section).getAllByText(/검증종목/)).toHaveLength(5);
  expect(within(section).getByText("검증종목0 (Q00000)")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
});
it("explicit refresh captures only the planted ticker quote and leaves the input untouched", async () => {
  const request = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ quotes: [{ ticker: "005930", lastPrice: 300 }] }),
    });
  vi.stubGlobal("fetch", request);
  render(<GardenDashboard garden={garden} />);
  fireEvent.click(screen.getByRole("button", { name: "대시보드 생성하기" }));
  fireEvent.click(
    screen.getByRole("button", { name: "시세 새로고침 · 재생성" }),
  );
  await waitFor(() =>
    expect(screen.getByText(/새로 조회 성공 1\/1종목/)).toBeTruthy(),
  );
  expect(screen.getAllByText("+200.00%").length).toBeGreaterThan(0);
  expect(request.mock.calls[0][0]).toBe("/api/quotes?tickers=005930");
  expect(garden.positions[0].lastPrice).toBe(150);
});
it("publishes successful batches and continues after the middle batch of 41 stocks fails", async () => {
  const positions = Array.from({ length: 41 }, (_, i) => ({
    ...garden.positions[0], id: `p${i}`, ticker: `Q${String(i).padStart(5, "0")}`, name: `검증${i}`,
  }));
  let finishLast!: () => void;
  const request = vi.fn(async (url: string) => {
    const codes = url.split("tickers=")[1].split(",");
    if (request.mock.calls.length === 2) throw new Error("batch unavailable");
    if (request.mock.calls.length === 3) await new Promise<void>((resolve) => { finishLast = resolve; });
    return { ok: true, json: async () => ({ generatedAt: "snapshot", fetchedAt: "now", sources: [], policy: "test",
      stocks: codes.map((ticker) => ({ ticker, disclosures: [{ title: `공시-${ticker}`, url: `https://example.com/${ticker}`, source: "test", publishedAt: "2026-10-09", type: "disclosure" }], news: [], newsStatus: "empty" })),
    }) };
  });
  vi.stubGlobal("fetch", request);
  vi.mocked(exportReport).mockResolvedValue(new Blob(["report"]));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal("URL", { createObjectURL: vi.fn().mockReturnValue("blob:test"), revokeObjectURL: vi.fn() });
  render(<GardenDashboard garden={{ ...garden, positions }} />);
  fireEvent.click(screen.getByRole("button", { name: "대시보드 생성하기" }));
  fireEvent.click(screen.getByRole("button", { name: "미분류·검토 필요 분석" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  // The first batch is visible while the last request is still pending.
  expect(screen.getAllByRole("link", { name: /공시-Q/ })).toHaveLength(10);
  finishLast();
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  const titles: string[] = [];
  for (let page = 0; page < 5; page++) {
    titles.push(...screen.queryAllByRole("link", { name: /공시-Q/ }).map((a) => a.textContent!));
    if (page === 2 || page === 3) {
      expect(screen.getAllByText("공시: 미조회/조회실패")).toHaveLength(10);
      expect(screen.queryByText(/게시 스냅샷에 기록 없음/)).toBeNull();
    }
    if (page < 4) fireEvent.click(screen.getByRole("button", { name: "종목 공시 뉴스 다음" }));
  }
  expect(titles).toHaveLength(21);
  expect(screen.getByRole("alert").textContent).toContain("20/41");
  fireEvent.click(screen.getByRole("button", { name: "MD 전체 다운로드" }));
  await waitFor(() => expect(exportReport).toHaveBeenCalled());
  const sections = vi.mocked(exportReport).mock.calls.at(-1)![2];
  expect(sections.flatMap((s) => s.rows).filter((r) => r.url)).toHaveLength(21);
});
it("does not retain old successful research during or after a failed forced refresh", async () => {
  let fail!: () => void;
  const request = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({
    generatedAt: "old", fetchedAt: "old", sources: [], policy: "old",
    stocks: [{ ticker: "005930", disclosures: [{ title: "old disclosure", url: "https://example.com/old", publishedAt: "2026-10-09", source: "old" }], news: [], newsStatus: "empty" }],
  }) }).mockImplementationOnce(() => new Promise((resolve) => { fail = () => resolve({ ok: false }); }));
  vi.stubGlobal("fetch", request);
  render(<GardenDashboard garden={garden} />);
  fireEvent.click(screen.getByRole("button", { name: "대시보드 생성하기" }));
  fireEvent.click(screen.getByRole("button", { name: "전자부품·통신장비 분석" }));
  await waitFor(() => expect(screen.getByRole("link", { name: /old disclosure/ })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "다시 분석" }));
  expect(screen.queryByRole("link", { name: /old disclosure/ })).toBeNull();
  expect(screen.getByText("공시: 미조회/조회실패")).toBeTruthy();
  fail();
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  expect(screen.queryByRole("link", { name: /old disclosure/ })).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("005930");
  vi.mocked(exportReport).mockResolvedValue(new Blob(["report"]));
  vi.stubGlobal("URL", { createObjectURL: vi.fn().mockReturnValue("blob:test"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "MD 전체 다운로드" }));
  await waitFor(() => expect(exportReport).toHaveBeenCalled());
  const rows = vi.mocked(exportReport).mock.calls.at(-1)![2].flatMap((s) => s.rows);
  expect(rows.some((r) => r.text.includes("old disclosure"))).toBe(false);
  expect(rows.some((r) => r.text === "공시: 미조회/조회실패")).toBe(true);
});
it("clears pending loading when navigating to cached research and ignores the late response", async () => {
  let finish!: () => void;
  const cached = { generatedAt: "cached", fetchedAt: "cached", sources: [], policy: "test", stocks: [{ ticker: "005930", disclosures: [], news: [], newsStatus: "empty" }] };
  const request = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => cached })
    .mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ ok: true, json: async () => ({ ...cached, fetchedAt: "late", stocks: [] }) }); }));
  vi.stubGlobal("fetch", request);
  render(<GardenDashboard garden={{ ...garden, positions: [...garden.positions, { ...garden.positions[0], id: "other", ticker: "Q00000" }] }} />);
  fireEvent.click(screen.getByRole("button", { name: "대시보드 생성하기" }));
  fireEvent.click(screen.getByRole("button", { name: "전자부품·통신장비 분석" }));
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "← 정원 전체" }));
  // Rapid navigation queues a new request and cached navigation before React commits.
  const uncached = screen.getByRole("button", { name: "미분류·검토 필요 분석" });
  const cache = screen.getByRole("button", { name: "전자부품·통신장비 분석" });
  act(() => { fireEvent.click(uncached); fireEvent.click(cache); });
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("status")).toBeNull();
  expect((screen.getByRole("button", { name: "MD 전체 다운로드" }) as HTMLButtonElement).disabled).toBe(false);
  await act(async () => { finish(); });
  expect(screen.getByRole("heading", { name: "전자부품·통신장비 · 섹터 분석" })).toBeTruthy();
  expect(screen.getByText(/뉴스 조회 cached/)).toBeTruthy();
});
it("empty garden dashboard is safe", () => {
  render(<GardenDashboard garden={{ ...garden, positions: [] }} />);
  fireEvent.click(screen.getByRole("button", { name: "대시보드 생성하기" }));
  expect(screen.getByText("아직 심긴 종목이 없습니다.")).toBeTruthy();
});
