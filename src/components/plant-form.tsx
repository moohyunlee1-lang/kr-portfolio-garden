"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BootScreen } from "@/components/boot";
import { useGardens } from "@/components/garden-context";
import { todayIso } from "@/lib/garden-math";
import { formatMoney, formatSignedPct } from "@/lib/format";
import { getQuote, searchQuotes } from "@/lib/quotes";

export function PlantForm({
  gardenId,
  plotIndex,
}: {
  gardenId: string;
  plotIndex?: number;
}) {
  const router = useRouter();
  const { ready, view, plant } = useGardens();
  const garden = ready ? view(gardenId) : null;
  const [query, setQuery] = useState("");
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [avgCost, setAvgCost] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(todayIso());
  const [error, setError] = useState("");
  const results = useMemo(() => searchQuotes(query), [query]);
  const selected = getQuote(ticker);
  const already = Boolean(
    selected && garden?.positions.some((position) => position.ticker === selected.ticker),
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const qty = Number(quantity);
    const cost = Number(avgCost);
    if (!selected) {
      setError("한국 종목을 선택하세요");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setError("수량은 1 이상의 정수여야 합니다");
      return;
    }
    if (!(cost > 0)) {
      setError("평단은 0보다 커야 합니다");
      return;
    }
    if (purchasedAt > todayIso()) {
      setError("매수일은 오늘 이후일 수 없습니다");
      return;
    }
    try {
      const result = plant(gardenId, {
        ticker: selected.ticker,
        quantity: qty,
        avgCost: cost,
        purchasedAt,
        plotIndex,
      });
      router.push(
        `/garden/${gardenId}?focus=${result.positionId}${result.merged ? "&merged=1" : ""}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "심지 못했습니다");
    }
  }

  if (!ready) return <BootScreen />;
  if (!garden) {
    return <p className="p-6 text-[#6b5344]">정원을 찾을 수 없습니다.</p>;
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-6"
    >
      <button
        type="button"
        className="min-h-11 self-start text-sm text-[#6b5344]"
        onClick={() => router.push(`/garden/${gardenId}`)}
      >
        ← {garden.name}
      </button>
      <div>
        <h1 className="text-2xl font-semibold">종목 심기</h1>
        <p className="mt-1 text-sm text-[#8a7362]">
          한국 주식만 심습니다. 같은 정원의 같은 종목은 한 그루로 합치고, 평단은 수량 가중 평균, 매수일은 더 이른 날짜를 유지합니다.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        종목 검색
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 또는 티커"
          className="min-h-11 rounded-2xl border border-[#eadcc6] bg-white px-3"
        />
      </label>
      <ul className="flex max-h-52 flex-col gap-1 overflow-auto">
        {results.map((item) => (
          <li key={item.ticker}>
            <button
              type="button"
              className={`flex min-h-11 w-full items-center justify-between rounded-2xl px-3 text-left text-sm ${
                ticker === item.ticker ? "bg-[#e7f0dc]" : "bg-white"
              }`}
              onClick={() => {
                setTicker(item.ticker);
                setQuery(item.name);
              }}
            >
              <span>
                {item.name} <span className="text-[#8a7362]">{item.ticker}</span>
              </span>
              <span className="text-[#6b5344]">{item.sector}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <p className="rounded-2xl bg-[#fffaf2] px-3 py-2 text-sm text-[#5c4332]">
          현재가 {formatMoney(selected.lastPrice)} · 등락 {formatSignedPct(selected.changePct)} · {selected.sector}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        수량
        <input
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="min-h-11 rounded-2xl border border-[#eadcc6] bg-white px-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        평단
        <input
          inputMode="decimal"
          value={avgCost}
          onChange={(event) => setAvgCost(event.target.value)}
          placeholder="매수 평균 단가"
          className="min-h-11 rounded-2xl border border-[#eadcc6] bg-white px-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        매수일
        <input
          type="date"
          value={purchasedAt}
          max={todayIso()}
          onChange={(event) => setPurchasedAt(event.target.value)}
          className="min-h-11 rounded-2xl border border-[#eadcc6] bg-white px-3"
        />
      </label>
      {error && <p className="text-sm text-[#c44848]">{error}</p>}
      <button type="submit" className="min-h-12 rounded-full bg-[#6f9a58] text-white">
        {already ? "한 그루로 합치기" : "이 칸에 심기"}
      </button>
    </motion.form>
  );
}
