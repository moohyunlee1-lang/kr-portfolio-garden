"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BootScreen } from "@/components/boot";
import { useGardens } from "@/components/garden-context";
import { Hud } from "@/components/hud";
import type { ScenePlant } from "@/components/garden-scene";
import {
  dividendPayDate,
  fruitSaturation,
  fruitTone,
  growthStage,
  isHarvestDue,
  maxMarketValue,
  sizeScale,
  todayIso,
  weatherFromKospi,
} from "@/lib/garden-math";
import { POLL_MS, shouldPoll } from "@/lib/market/session";
import type { LiveQuote } from "@/lib/market/types";
import { KOSPI_RETURN_1D } from "@/lib/quotes";
import { harvestKey } from "@/lib/storage";
import { classifyTree } from "@/lib/tree-traits";
import { classifyRangeEffect } from "@/lib/range-effects";

const GardenScene = dynamic(() => import("@/components/garden-scene"), {
  ssr: false,
  loading: () => <BootScreen label="밭을 고르는 중" />,
});

export function GardenView({
  gardenId,
  focusId,
  merged,
}: {
  gardenId: string;
  focusId?: string;
  merged?: boolean;
}) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const { ready, view, remember, createGarden, addSample, harvested, markHarvested, applyLive } =
    useGardens();
  const garden = ready ? view(gardenId) : null;
  const [kospi1d, setKospi1d] = useState(KOSPI_RETURN_1D);
  const [kosdaq1d, setKosdaq1d] = useState(0);
  const weather = weatherFromKospi(kospi1d, kosdaq1d);
  const tickerKey = (garden?.positions ?? []).map((position) => position.ticker).join(",");
  const tickers = useMemo(
    () => (tickerKey ? [...new Set(tickerKey.split(","))] : []),
    [tickerKey],
  );

  useEffect(() => {
    let cancelled = false;
    let first = true;

    async function loadQuotes(codes: string[]) {
      const live: LiveQuote[] = [];
      for (let index = 0; index < codes.length; index += 20) {
        const chunk = codes.slice(index, index + 20);
        const response = await fetch(`/api/quotes?tickers=${chunk.join(",")}`);
        if (!response.ok) continue;
        const data = (await response.json()) as { quotes?: LiveQuote[] };
        live.push(...(data.quotes ?? []));
      }
      if (!cancelled && live.length) applyLive(live);
    }

    async function tick() {
      const hidden = typeof document !== "undefined" && document.hidden;
      if (!first && !shouldPoll(new Date(), hidden)) return;
      first = false;
      try {
        const response = await fetch("/api/market");
        const data = (await response.json()) as { kospi?: number | null; kosdaq?: number | null };
        if (cancelled) return;
        if (typeof data.kospi === "number" && Number.isFinite(data.kospi)) setKospi1d(data.kospi);
        if (typeof data.kosdaq === "number" && Number.isFinite(data.kosdaq)) setKosdaq1d(data.kosdaq);
      } catch {
        /* keep last */
      }
      if (cancelled) return;
      if (tickers.length) {
        try {
          await loadQuotes(tickers);
        } catch {
          /* keep last */
        }
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
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

  useEffect(() => {
    if (ready) remember(gardenId);
  }, [ready, gardenId, remember]);

  if (!ready) return <BootScreen />;
  if (!garden) {
    return (
      <div className="grid h-dvh place-items-center bg-[#efe4d2] px-6 text-center text-[#6b5344]">
        <div>
          <p>정원을 찾을 수 없습니다.</p>
          <button type="button" className="mt-3 underline" onClick={() => router.push("/")}>
            마지막 정원으로
          </button>
        </div>
      </div>
    );
  }

  const max = maxMarketValue(garden.positions);
  const today = todayIso();
  const plants: ScenePlant[] = garden.positions.map((position) => {
    const payDate = dividendPayDate(position.dividend);
    const picked = payDate ? harvested.includes(harvestKey(position.id, payDate)) : false;
    return {
      id: position.id,
      plotIndex: position.plotIndex,
      name: position.name,
      ticker: position.ticker,
      sector: position.sector,
      stage: growthStage(position.unrealizedPnlPct, position.holdingDays, position.dividend),
      scale: sizeScale(position.marketValue, max),
      tone: fruitTone(position.dividend, picked),
      saturation: fruitSaturation(position.dividend, picked),
      highlight: position.id === focusId,
      harvestDue: isHarvestDue(position.dividend, today, picked),
      traits: classifyTree(position.fundamentals),
      rangeEffect: classifyRangeEffect(position.range),
    };
  });

  return (
    <div className="relative h-dvh overflow-hidden bg-[#d7ebf6]">
      <GardenScene
        plants={plants}
        weather={weather.regime}
        kosdaqReturn1d={weather.kosdaqReturn1d}
        reduced={reduced}
        onOpen={(positionId) => router.push(`/garden/${gardenId}/plant/${positionId}`)}
        onEmpty={(plotIndex) =>
          router.push(`/garden/${gardenId}/plant/new?plot=${plotIndex}`)
        }
        onHarvested={(positionId) => {
          const position = garden.positions.find((item) => item.id === positionId);
          const payDate = dividendPayDate(position?.dividend);
          if (payDate) markHarvested(harvestKey(positionId, payDate));
        }}
      />
      <Hud
        garden={garden}
        weather={weather}
        onSwitch={(id) => {
          remember(id);
          router.push(`/garden/${id}`);
        }}
        onCreate={() => router.push(`/garden/${createGarden()}`)}
        onSample={() => router.push(`/garden/${addSample()}`)}
      />
      {garden.positions.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center px-4">
          <div className="pointer-events-auto max-w-sm rounded-[28px] bg-[#fffaf2]/95 px-5 py-4 text-center shadow-lg">
            <p className="text-sm text-[#5c4332]">빈 칸을 눌러 한국 주식을 심으세요.</p>
            <button
              type="button"
              className="mt-3 min-h-11 rounded-full bg-[#6f9a58] px-4 text-sm text-white"
              onClick={() => router.push(`/garden/${addSample()}`)}
            >
              샘플 정원 보기
            </button>
          </div>
        </div>
      )}
      <AnimatePresence>
        {merged && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#3e342b] px-4 py-2 text-sm text-[#fffaf2]"
          >
            같은 종목이라 한 그루로 합쳤습니다. 평단을 다시 계산했습니다.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
