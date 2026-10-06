"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Garden } from "@/lib/types";
import { formatMoney, formatSignedPct } from "@/lib/format";
import { crossMark } from "@/lib/cross-seed";
import { filterTreeList, treeListPage } from "@/lib/tree-list";
import crossReport from "@/data/cross-garden-report.json";
import maReport from "@/data/ma-garden-report.json";
import { riskGardenNotice } from "@/lib/risk-caveat";

/** A right-hand inventory of planted trees. The large cross garden loads rows in pages. */
export function TreeListPanel({ garden }: { garden: Garden }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const matches = useMemo(() => filterTreeList(garden.positions, query), [garden.positions, query]);
  const visible = useMemo(() => treeListPage(matches, page), [matches, page]);

  return (
    <>
      {!mobileOpen && (
        <button
          type="button"
          aria-label="정원의 나무 목록 열기"
          aria-expanded={false}
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-12 items-center gap-2 rounded-full border border-[#d9c8aa] bg-[#fffaf2]/95 px-5 font-display text-base text-[#3e342b] shadow-[0_8px_24px_rgba(55,45,30,0.2)] backdrop-blur-md lg:hidden"
        >
          <span aria-hidden="true">♧</span> 나무 목록 <span className="text-sm tabular-nums text-[#6f9a58]">{garden.positions.length}</span>
        </button>
      )}
      <aside
        aria-label={`${garden.name} 나무 목록`}
        className={`${mobileOpen ? "flex" : "hidden"} fixed bottom-3 right-3 z-30 h-[min(70dvh,38rem)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[28px] border border-[#eadcc6] bg-[#fffaf2]/95 shadow-[0_12px_36px_rgba(55,45,30,0.2)] backdrop-blur-xl lg:relative lg:bottom-auto lg:right-auto lg:flex lg:h-full lg:w-80 lg:shrink-0 lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-[-8px_0_30px_rgba(55,45,30,0.1)]`}
      >
        <div className="border-b border-[#eadcc6] px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs tracking-wide text-[#8a7362]">그루밭 · 나무 도감</p>
              <h2 className="font-display text-2xl leading-tight text-[#3e342b]">정원의 나무</h2>
            </div>
            <button
              type="button"
              aria-label="나무 목록 닫기"
              onClick={() => setMobileOpen(false)}
              className="min-h-11 min-w-11 rounded-full bg-[#f3e4cc] text-xl text-[#5c4332] lg:hidden"
            >×</button>
          </div>
          <p className="mt-1 text-xs text-[#8a7362]">{garden.name} · {garden.positions.length}그루</p>
          {garden.id === "cross_watch" && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
              교차 신호 {crossReport.as_of} 기준 · {crossReport.status.complete ? "전체 관측" : "부분 관측 (누락 종목 있음)"}. 현재 신호로 해석하지 마세요.
            </p>
          )}
          {garden.id === "ma_watch" && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
              이동평균 신호 {maReport.as_of} 기준 스냅샷 · 현재 신호로 해석하지 마세요.
            </p>
          )}
          {riskGardenNotice(garden.id) && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
              {riskGardenNotice(garden.id)}
            </p>
          )}
          <label className="mt-4 block">
            <span className="sr-only">현재 정원 나무 검색</span>
            <input
              type="search"
              aria-label="현재 정원 나무 검색"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="이름 또는 종목코드 검색"
              className="min-h-11 w-full rounded-2xl border border-[#eadcc6] bg-white/90 px-4 text-sm text-[#3e342b] outline-none placeholder:text-[#9f8d7d] focus:border-[#6f9a58] focus:ring-2 focus:ring-[#6f9a58]/20"
            />
          </label>
          <p className="mt-2 text-xs tabular-nums text-[#8a7362]" aria-live="polite">{matches.length}그루 표시 · 심긴 순서</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
          {matches.length === 0 && (
            <p className="rounded-2xl bg-white/70 px-4 py-8 text-center text-sm text-[#8a7362]">
              {query.trim() ? "검색한 나무가 없습니다." : "아직 심긴 나무가 없습니다."}
            </p>
          )}
          {visible.map((tree) => {
            const mark = crossMark(tree.ticker);
            const pnl = tree.unrealizedPnlPct;
            return (
              <div key={tree.id} className="flex items-center gap-1 rounded-[18px] border border-[#eadcc6]/80 bg-white/80 p-1 shadow-[0_2px_7px_rgba(92,64,36,0.05)]">
                <button
                  type="button"
                  aria-label={`${tree.name} 나무로 이동`}
                  onClick={() => { setMobileOpen(false); router.push(`/garden/${garden.id}?focus=${encodeURIComponent(tree.id)}`); }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] px-2 py-2 text-left hover:bg-[#f2eedf] focus-visible:outline-2 focus-visible:outline-[#6f9a58]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e9f0db] text-lg text-[#547e41]" aria-hidden="true">♣</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold text-[#3e342b]">
                      <span className="truncate">{tree.name}</span>
                      {mark && <span title={mark === "golden" ? "골든크로스" : "데드크로스"} className={mark === "golden" ? "text-[#c48b12]" : "text-[#64536f]"} aria-label={mark === "golden" ? "골든크로스" : "데드크로스"}>{mark === "golden" ? "★" : "☠"}</span>}
                    </span>
                    <span className="block text-xs tabular-nums text-[#8a7362]">{tree.ticker} · {formatMoney(tree.lastPrice)}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold tabular-nums ${pnl > 0 ? "pnl-up" : pnl < 0 ? "pnl-down" : "text-[#8a7362]"}`}>{formatSignedPct(pnl)}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${tree.name} 나무 정보`}
                  title="나무 정보"
                  onClick={() => router.push(`/garden/${garden.id}/plant/${tree.id}`)}
                  className="min-h-11 min-w-10 rounded-xl text-sm text-[#806b56] hover:bg-[#f3e4cc] focus-visible:outline-2 focus-visible:outline-[#6f9a58]"
                >↗</button>
              </div>
            );
          })}
          {visible.length < matches.length && (
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              className="min-h-11 w-full rounded-2xl border border-[#d9c8aa] bg-[#f3e4cc] px-3 text-sm font-medium text-[#5c4332] hover:bg-[#e9d7b9]"
            >더 보기 · {visible.length}/{matches.length}</button>
          )}
        </div>
        <p className="border-t border-[#eadcc6] px-5 py-3 text-xs text-[#8a7362]">나무를 누르면 정원에서 위치를 찾습니다.</p>
      </aside>
    </>
  );
}
