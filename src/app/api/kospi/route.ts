import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  try {
    const response = await fetch("https://m.stock.naver.com/api/index/KOSPI/basic", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://m.stock.naver.com/",
      },
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return NextResponse.json({ changePct: null }, { status: 502 });
    }
    const data = (await response.json()) as { fluctuationsRatio?: string | number };
    const parsed = Number(String(data.fluctuationsRatio ?? "").replace(/,/g, ""));
    if (!Number.isFinite(parsed)) {
      return NextResponse.json({ changePct: null }, { status: 502 });
    }
    return NextResponse.json({ changePct: parsed });
  } catch {
    return NextResponse.json({ changePct: null }, { status: 502 });
  }
}
