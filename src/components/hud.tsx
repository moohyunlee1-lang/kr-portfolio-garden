"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatMoney,
  formatSignedMoney,
  formatSignedPct,
  WEATHER_LABEL,
} from "@/lib/format";
import { gardenSnapshot, searchPlantedTrees } from "@/lib/garden-math";
import type { Garden, StoredGarden, Weather } from "@/lib/types";
import { useGardens } from "@/components/garden-context";
import { countRangeEffects } from "@/lib/range-effects";

const SECTOR_ORDER = [
  "반도체",
  "2차전지",
  "바이오",
  "로봇",
  "조선",
  "방산",
  "원전",
  "자동차",
  "화장품",
  "대기업·금융그룹",
  "전환사채",
  "이동평균선",
];

function gardenGroups(gardens: StoredGarden[]) {
  const mine = gardens.filter((garden) => !garden.group);
  const rest = new Map<string, StoredGarden[]>();
  for (const garden of gardens) {
    if (!garden.group) continue;
    const list = rest.get(garden.group) ?? [];
    list.push(garden);
    rest.set(garden.group, list);
  }
  const sections = [{ label: "내 정원", items: mine }].filter((section) => section.items.length > 0);
  for (const name of SECTOR_ORDER) {
    const items = rest.get(name);
    if (items?.length) sections.push({ label: name, items });
  }
  for (const [name, items] of rest) {
    if (!SECTOR_ORDER.includes(name)) sections.push({ label: name, items });
  }
  return sections;
}

export function Hud({
  garden,
  weather,
  onSwitch,
  onCreate,
  onSample,
}: {
  garden: Garden;
  weather: Weather;
  onSwitch: (gardenId: string) => void;
  onCreate: () => void;
  onSample: () => void;
}) {
  const { gardens, renameGarden, deleteGarden, rangeFor } = useGardens();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [treeQuery, setTreeQuery] = useState("");
  const totals = gardenSnapshot(garden.positions);
  const treeHits = useMemo(
    () => searchPlantedTrees(gardens, treeQuery),
    [gardens, treeQuery],
  );
  const searching = Boolean(treeQuery.trim());
  const pnlClass =
    totals.unrealizedPnlAmt > 0 ? "pnl-up" : totals.unrealizedPnlAmt < 0 ? "pnl-down" : "";

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-[28px] border border-[#eadcc6] bg-[#fffaf2]/90 px-4 py-3 shadow-[0_10px_28px_rgba(92,64,36,0.12)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs tracking-wide text-[#8a7362]">그루밭</p>
            <h1 className="font-display text-2xl leading-none text-[#3e342b]">{garden.name}</h1>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full bg-[#f3e4cc] px-4 text-sm font-medium text-[#5c4332]"
              onClick={() => router.push("/rank")}
            >
              순위
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full bg-[#f3e4cc] px-4 text-sm font-medium text-[#5c4332]"
              onClick={() => setOpen((value) => !value)}
            >
              정원 바꾸기
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="총평가" value={formatMoney(totals.marketValue)} />
          <Stat
            label="평가손익"
            value={formatSignedMoney(totals.unrealizedPnlAmt)}
            className={pnlClass}
          />
          <Stat
            label="손익률"
            value={formatSignedPct(totals.unrealizedPnlPct)}
            className={pnlClass}
          />
          <Stat label="종목" value={`${totals.count}`} />
        </div>
        <p className="text-xs text-[#8a7362]">
          코스피 1일 {formatSignedPct(weather.kospiReturn1d)} · {WEATHER_LABEL[weather.regime]}
          {" · "}
          코스닥 1일 {formatSignedPct(weather.kosdaqReturn1d)}
          {weather.kosdaqReturn1d > 0 ? " · 나비" : weather.kosdaqReturn1d < 0 ? " · 천둥" : ""}
        </p>
        {open && (
          <div className="flex flex-col gap-2 border-t border-[#eadcc6] pt-3">
            <input
              aria-label="나무 검색"
              value={treeQuery}
              onChange={(event) => setTreeQuery(event.target.value)}
              placeholder="나무 검색 · 이름 또는 티커"
              className="min-h-11 rounded-2xl border border-[#eadcc6] bg-white px-3 text-sm"
            />
            <div className="flex max-h-[min(24rem,48dvh)] flex-col gap-2 overflow-auto">
              {searching ? (
                treeHits.length === 0 ? (
                  <p className="px-1 py-6 text-center text-sm text-[#8a7362]">심긴 나무가 없습니다.</p>
                ) : (
                  treeHits.map((hit) => (
                    <div key={`${hit.gardenId}-${hit.positionId}`} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#3e342b]">
                          {hit.name}{" "}
                          <span className="font-normal text-[#8a7362]">{hit.ticker}</span>
                        </p>
                        <p className="truncate text-xs text-[#8a7362]">
                          {hit.group ? `${hit.group} · ` : ""}
                          {hit.gardenName}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="min-h-11 shrink-0 rounded-2xl bg-[#6f9a58] px-3 text-sm text-white"
                        onClick={() => {
                          setOpen(false);
                          setTreeQuery("");
                          router.push(`/garden/${hit.gardenId}?focus=${hit.positionId}`);
                        }}
                      >
                        입장
                      </button>
                    </div>
                  ))
                )
              ) : (
                gardenGroups(gardens).map((section) => (
                  <div key={section.label} className="flex flex-col gap-1">
                    <p className="px-1 pt-1 text-xs font-medium tracking-wide text-[#8a7362]">
                      {section.label}
                    </p>
                    {section.items.map((item) => {
                      const marks = countRangeEffects(
                        item.positions.map((position) => position.ticker),
                        rangeFor,
                      );
                      return (
                        <div key={item.id} className="flex items-center gap-2">
                          <input
                            aria-label={`${item.name} 이름`}
                            className="min-h-11 flex-1 rounded-2xl border border-[#eadcc6] bg-white px-3 text-sm"
                            defaultValue={item.name}
                            onBlur={(event) => renameGarden(item.id, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") event.currentTarget.blur();
                            }}
                          />
                          <RangeBadges fire={marks.fire} aura={marks.aura} />
                          <button
                            type="button"
                            className="min-h-11 rounded-2xl bg-[#6f9a58] px-3 text-sm text-white"
                            onClick={() => {
                              setOpen(false);
                              onSwitch(item.id);
                            }}
                          >
                            입장
                          </button>
                          <button
                            type="button"
                            className="min-h-11 rounded-2xl bg-[#f3e4cc] px-3 text-sm text-[#c44848] disabled:opacity-40"
                            disabled={gardens.length <= 1}
                            onClick={() => {
                              if (gardens.length <= 1) return;
                              if (!window.confirm(`${item.name} 정원을 삭제할까요?`)) return;
                              const next = deleteGarden(item.id);
                              if (next && next !== garden.id) {
                                setOpen(false);
                                onSwitch(next);
                              }
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-11 flex-1 rounded-2xl bg-[#f3e4cc] text-sm"
                onClick={onCreate}
              >
                새 정원
              </button>
              <button
                type="button"
                className="min-h-11 flex-1 rounded-2xl bg-[#f3e4cc] text-sm"
                onClick={onSample}
              >
                샘플 정원
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function RangeBadges({ fire, aura }: { fire: number; aura: number }) {
  if (!fire && !aura) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {fire > 0 && (
        <span
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#ff7a3a] px-2 py-1 text-white"
          title={`52주 신고가 ${fire}그루`}
        >
          <img src="/fx-fire.svg" alt="" className="h-5 w-5" />
          <span className="text-xs font-semibold tabular-nums">{fire}</span>
        </span>
      )}
      {aura > 0 && (
        <span
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#2a1638] px-2 py-1 text-[#e8d7ff]"
          title={`52주 신저가 ${aura}그루`}
        >
          <img src="/fx-aura.svg" alt="" className="h-5 w-5" />
          <span className="text-xs font-semibold tabular-nums">{aura}</span>
        </span>
      )}
    </span>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs text-[#8a7362]">{label}</p>
      <p className={`font-semibold tabular-nums ${className}`}>{value}</p>
    </div>
  );
}
