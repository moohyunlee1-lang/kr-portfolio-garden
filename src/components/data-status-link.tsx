import React from "react";
import Link from "next/link";

export function DataStatusLink({ ticker }: { ticker?: string }) {
  const href = ticker && /^[0-9A-Z]{6}$/.test(ticker) ? `/data-status?ticker=${ticker}` : "/data-status";
  return <Link href={href} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm text-[#386247] underline underline-offset-4">데이터 상태/근거 · 가격 시점 미상</Link>;
}
