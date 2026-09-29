"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BootScreen } from "@/components/boot";
import { useGardens } from "@/components/garden-context";
import { formatSignedPct } from "@/lib/format";
import { gardensHoldingTicker } from "@/lib/garden-math";
import type { LiveQuote } from "@/lib/market/types";
import { QUOTE_BATCH_LIMIT, RANK_POLL_MS, shouldPoll } from "@/lib/market/session";
import { RANK_PERIODS, rankGardens, rankTrees, type RankPeriod } from "@/lib/ranks";

type Scope = "garden" | "tree";

export function RankBoard() {
  const router = useRouter();
  const { ready, gardens, view, entryId, applyLive, liveTickers } = useGardens();
  const [scope, setScope] = useState<Scope>("garden");
  const [period, setPeriod] = useState<RankPeriod>("day");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const tickers = useMemo(() => {
    const seen = new Set<string>();
    for (const garden of gardens) {
      for (const position of garden.positions) seen.add(position.ticker);
    }
    return [...seen];
  }, [gardens]);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    let inFlight = false;

    async function loadQuotes(codes: string[]) {
      for (let index = 0; index < codes.length; index += QUOTE_BATCH_LIMIT) {
        if (cancelled) return;
        const chunk = codes.slice(index, index + QUOTE_BATCH_LIMIT);
        const response = await fetch(`/api/quotes?tickers=${chunk.join(",")}`);
        if (!response.ok) continue;
        const data = (await response.json()) as { quotes?: LiveQuote[] };
        const rows = data.quotes ?? [];
        if (!cancelled && rows.length) {
          applyLive(rows);
          setUpdatedAt(new Date());
        }
      }
    }

    async function tick() {
      const hidden = typeof document !== "undefined" && document.hidden;
      if (!first && !shouldPoll(new Date(), hidden)) return;
      if (inFlight || !tickers.length) return;
      first = false;
      inFlight = true;
      try {
        await loadQuotes(tickers);
      } catch {
        /* keep last */
      } finally {
        inFlight = false;
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), RANK_POLL_MS);
    const onVis = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [applyLive, tickers]);

  const materialized = useMemo(
    () =>
      gardens
        .map((stored) => {
          const garden = view(stored.id);
          return garden ? { ...garden, group: stored.group } : null;
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    [gardens, view],
  );

  const gardenRows = useMemo(
    () => rankGardens(materialized, period, liveTickers),
    [materialized, period, liveTickers],
  );
  const treeRows = useMemo(
    () => rankTrees(materialized, period, liveTickers),
    [materialized, period, liveTickers],
  );
  const hint = RANK_PERIODS.find((item) => item.id === period)?.hint ?? "";
  const liveHint =
    period === "day" && tickers.length
      ? ` · 시세 ${liveTickers.size}/${tickers.length}`
      : "";

  if (!ready) return <BootScreen />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs tracking-wide text-[#8a7362]">그루밭</p>
          <h1 className="font-display text-4xl leading-none text-[#3e342b]">순위</h1>
          <p className="mt-2 text-sm text-[#8a7362]">
            {hint}
            {liveHint}
            {updatedAt ? ` · ${formatSeoulTime(updatedAt)} 갱신` : ""}
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-full bg-[#f3e4cc] px-4 text-sm font-medium text-[#5c4332]"
          onClick={() => router.push(entryId ? `/garden/${entryId}` : "/")}
        >
          정원으로
        </button>
      </header>

      <div className="flex gap-2">
        <Tab active={scope === "garden"} onClick={() => setScope("garden")}>
          정원
        </Tab>
        <Tab active={scope === "tree"} onClick={() => setScope("tree")}>
          나무
        </Tab>
      </div>
      <div className="flex flex-wrap gap-2">
        {RANK_PERIODS.map((item) => (
          <Tab key={item.id} active={period === item.id} onClick={() => setPeriod(item.id)}>
            {item.label}
          </Tab>
        ))}
      </div>

      <ol className="flex flex-col gap-2 pb-8">
        {scope === "garden" &&
          gardenRows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-[22px] border border-[#eadcc6] bg-[#fffaf2] px-3 py-3"
            >
              <RankMark rank={row.rank} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[#3e342b]">{row.name}</p>
                <p className="text-xs text-[#8a7362]">
                  {row.group ? `${row.group} · ` : ""}
                  {row.count}그루
                </p>
              </div>
              <p className={`shrink-0 font-semibold tabular-nums ${pnlClass(row.returnPct)}`}>
                {formatSignedPct(row.returnPct)}
              </p>
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-2xl bg-[#6f9a58] px-3 text-sm text-white"
                onClick={() => router.push(`/garden/${row.id}`)}
              >
                입장
              </button>
            </li>
          ))}
        {scope === "tree" &&
          treeRows.map((row) => (
            <li
              key={`${row.gardenId}-${row.positionId}`}
              className="flex items-center gap-3 rounded-[22px] border border-[#eadcc6] bg-[#fffaf2] px-3 py-3"
            >
              <RankMark rank={row.rank} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[#3e342b]">{row.name}</p>
                <p className="truncate text-xs text-[#8a7362]">
                  {row.ticker} · {row.gardenName}
                </p>
              </div>
              <p className={`shrink-0 font-semibold tabular-nums ${pnlClass(row.returnPct)}`}>
                {formatSignedPct(row.returnPct)}
              </p>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:justify-end">
                {enterHomes(gardens, row).map((home) => (
                  <button
                    key={home.id}
                    type="button"
                    className="min-h-11 rounded-2xl bg-[#6f9a58] px-3 text-sm text-white"
                    onClick={() => router.push(`/garden/${home.id}?focus=${home.positionId}`)}
                  >
                    {home.id === row.gardenId ? "입장" : home.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="min-h-11 rounded-2xl bg-[#f3e4cc] px-3 text-sm text-[#5c4332]"
                  onClick={() => router.push(`/garden/${row.gardenId}/plant/${row.positionId}`)}
                >
                  나무 정보
                </button>
              </div>
            </li>
          ))}
        {scope === "garden" && gardenRows.length === 0 && (
          <Empty waiting={period === "day" && liveTickers.size === 0} />
        )}
        {scope === "tree" && treeRows.length === 0 && (
          <Empty waiting={period === "day" && liveTickers.size === 0} />
        )}
      </ol>
    </main>
  );
}

function enterHomes(
  gardens: Parameters<typeof gardensHoldingTicker>[0],
  row: { gardenId: string; gardenName: string; positionId: string; ticker: string },
) {
  const homes = gardensHoldingTicker(gardens, row.ticker);
  return homes.length ? homes : [{ id: row.gardenId, name: row.gardenName, positionId: row.positionId }];
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`min-h-11 flex-1 rounded-full px-3 text-sm font-medium ${
        active ? "bg-[#6f9a58] text-white" : "bg-[#f3e4cc] text-[#5c4332]"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RankMark({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? "bg-[#e2b93b] text-[#3e342b]" : rank === 2 ? "bg-[#c9c4bb] text-[#3e342b]" : rank === 3 ? "bg-[#d7a07a] text-white" : "bg-[#f3e4cc] text-[#8a7362]";
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${tone}`}>
      {rank}
    </span>
  );
}

function pnlClass(value: number) {
  if (value > 0) return "pnl-up";
  if (value < 0) return "pnl-down";
  return "";
}

function Empty({ waiting }: { waiting?: boolean }) {
  return (
    <li className="rounded-[22px] bg-[#fffaf2] px-4 py-8 text-center text-sm text-[#8a7362]">
      {waiting ? "당일 시세를 불러오는 중입니다." : "순위 데이터가 없습니다."}
    </li>
  );
}

function formatSeoulTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
