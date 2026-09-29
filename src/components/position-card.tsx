"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { BootScreen } from "@/components/boot";
import { useGardens } from "@/components/garden-context";
import {
  STAGE_LABEL,
  formatDate,
  formatMarketCap,
  formatMoney,
  formatMultiple,
  formatSignedMoney,
  formatSignedPct,
  formatVolume,
  formatWhen,
  formatWonOrDash,
} from "@/lib/format";
import {
  dividendPayDate,
  fruitSaturation,
  fruitTone,
  gardensHoldingTicker,
  growthStage,
  isHarvestDue,
  todayIso,
} from "@/lib/garden-math";
import { harvestKey } from "@/lib/storage";
import { classifyTree } from "@/lib/tree-traits";

const PlantHero = dynamic(() => import("@/components/plant-hero"), { ssr: false });

export function PositionCard({
  gardenId,
  positionId,
}: {
  gardenId: string;
  positionId: string;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { ready, view, gardens, harvested, markHarvested } = useGardens();
  const garden = ready ? view(gardenId) : null;
  const position = garden?.positions.find((item) => item.id === positionId);
  const homes = position ? gardensHoldingTicker(gardens, position.ticker) : [];
  const [picking, setPicking] = useState(false);
  const payDate = dividendPayDate(position?.dividend);
  const harvestedNow = payDate ? harvested.includes(harvestKey(positionId, payDate)) : false;
  const due = isHarvestDue(position?.dividend, todayIso(), harvestedNow);

  if (!ready) return <BootScreen />;
  if (!garden || !position) {
    return <p className="p-6 text-[#6b5344]">종목을 찾을 수 없습니다.</p>;
  }

  const stage = growthStage(
    position.unrealizedPnlPct,
    position.holdingDays,
    position.dividend,
  );
  const traits = classifyTree(position.fundamentals);
  const tone = fruitTone(position.dividend, harvestedNow);
  const pnlClass =
    position.unrealizedPnlAmt > 0
      ? "pnl-up"
      : position.unrealizedPnlAmt < 0
        ? "pnl-down"
        : "";

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 py-6"
    >
      <button
        type="button"
        className="min-h-11 self-start text-sm text-[#6b5344]"
        onClick={() => router.push(`/garden/${gardenId}?focus=${position.id}`)}
      >
        ← 정원으로
      </button>
      <div className="h-56 overflow-hidden rounded-[28px] bg-[#d7ebf6]">
        <PlantHero
          sector={position.sector}
          stage={stage}
          tone={tone}
          saturation={fruitSaturation(position.dividend, harvestedNow)}
          traits={traits}
        />
      </div>
      <header>
        <p className="text-sm text-[#8a7362]">
          {position.sector} · {STAGE_LABEL[stage]} · {traits.label}
        </p>
        <h1 className="font-display text-4xl">{position.name}</h1>
        <p className="text-[#8a7362]">{position.ticker}</p>
      </header>
      <section className="rounded-[24px] bg-white p-4">
        <h2 className="font-semibold">심긴 정원</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {homes.map((home) => (
            <li key={home.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[#3e342b]">{home.name}</p>
                {home.group ? <p className="truncate text-xs text-[#8a7362]">{home.group}</p> : null}
              </div>
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-2xl bg-[#6f9a58] px-3 text-sm text-white"
                onClick={() => router.push(`/garden/${home.id}?focus=${home.positionId}`)}
              >
                입장
              </button>
            </li>
          ))}
          {homes.length === 0 && <li className="text-sm text-[#8a7362]">심긴 정원이 없습니다.</li>}
        </ul>
      </section>
      <section className="grid grid-cols-3 gap-3 rounded-[24px] bg-[#fffaf2] p-4">
        <Field label="현재가" value={formatMoney(position.lastPrice)} />
        <Field label="등락률" value={formatSignedPct(position.changePct)} />
        <Field label="거래량" value={formatVolume(position.volume)} />
      </section>
      <section className="grid grid-cols-2 gap-3 rounded-[24px] bg-[#fffaf2] p-4 sm:grid-cols-3">
        <Field label="시가총액" value={formatMarketCap(position.fundamentals?.marketCap)} />
        <Field label="PBR" value={formatMultiple(position.fundamentals?.pbr)} />
        <Field label="PER" value={formatMultiple(position.fundamentals?.per)} />
        <Field label="EPS" value={formatWonOrDash(position.fundamentals?.eps)} />
        <Field label="주당부채" value={formatWonOrDash(position.fundamentals?.debtPerShare)} />
        <Field
          label="부채비율"
          value={
            position.fundamentals?.debtRatioPct == null || !Number.isFinite(position.fundamentals.debtRatioPct)
              ? "—"
              : `${position.fundamentals.debtRatioPct.toFixed(1)}%`
          }
        />
      </section>
      <section className="grid grid-cols-2 gap-3 rounded-[24px] bg-white p-4">
        <Field label="수량" value={`${position.quantity.toLocaleString("ko-KR")}주`} />
        <Field label="평단" value={formatMoney(position.avgCost)} />
        <Field label="평가금액" value={formatMoney(position.marketValue)} />
        <Field
          label="평가손익"
          value={`${formatSignedMoney(position.unrealizedPnlAmt)} (${formatSignedPct(position.unrealizedPnlPct)})`}
          className={pnlClass}
        />
        <Field label="보유기간" value={`${position.holdingDays}일`} />
        <Field label="비중" value={`${position.weightPct.toFixed(1)}%`} />
      </section>
      <section className="rounded-[24px] bg-[#fffaf2] p-4">
        <h2 className="font-semibold">배당</h2>
        {position.dividend ? (
          <div className="mt-2 flex flex-col gap-1 text-sm text-[#5c4332]">
            <p>
              {position.dividend.isConfirmed ? "확정 지급일" : "예상 지급일"}{" "}
              {formatDate(payDate ?? undefined)}
            </p>
            <p>최근 배당 {formatMoney(position.dividend.lastAmount)} · 배당수익률 {position.dividend.yieldPct.toFixed(2)}%</p>
            <p>{tone === "vivid" ? "열매가 선명합니다." : tone === "muted" ? "예상 열매라 채도가 낮습니다." : "수확한 열매는 걷어 냈습니다."}</p>
            {due && !picking && (
              <button
                type="button"
                className="mt-2 min-h-11 rounded-full bg-[#e07a55] text-white"
                onClick={() => setPicking(true)}
              >
                수확하기
              </button>
            )}
            {picking && (
              <motion.p
                initial={{ y: 0, opacity: 1 }}
                animate={{ y: reduced ? 0 : -28, opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.7 }}
                onAnimationComplete={() => {
                  if (payDate) markHarvested(harvestKey(position.id, payDate));
                  setPicking(false);
                }}
                className="text-[#e07a55]"
              >
                열매를 수확했습니다
              </motion.p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#8a7362]">예정된 한국 배당이 없습니다.</p>
        )}
      </section>
      <section className="rounded-[24px] bg-white p-4">
        <h2 className="font-semibold">뉴스 · 공시</h2>
        <p className="mt-1 text-xs text-[#8a7362]">제목과 출처만 보여 줍니다. 손익의 원인으로 읽지 마세요.</p>
        <ul className="mt-3 flex flex-col gap-3">
          {(position.issues ?? []).map((issue) => (
            <li key={`${issue.publishedAt}-${issue.title}`} className="text-sm">
              <p>{issue.title}</p>
              <p className="text-xs text-[#8a7362]">
                {formatWhen(issue.publishedAt)} · {issue.source} · {issue.type === "disclosure" ? "공시" : "뉴스"}
              </p>
            </li>
          ))}
          {(position.issues ?? []).length === 0 && (
            <li className="text-sm text-[#8a7362]">최근 항목이 없습니다.</li>
          )}
        </ul>
      </section>
    </motion.article>
  );
}

function Field({
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
