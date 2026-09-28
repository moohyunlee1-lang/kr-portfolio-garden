import { NextResponse } from "next/server";

export const revalidate = 60;

async function indexChange(code: "KOSPI" | "KOSDAQ"): Promise<number | null> {
  const response = await fetch(`https://m.stock.naver.com/api/index/${code}/basic`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://m.stock.naver.com/",
    },
    next: { revalidate: 60 },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { fluctuationsRatio?: string | number };
  const parsed = Number(String(data.fluctuationsRatio ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const [kospi, kosdaq] = await Promise.all([indexChange("KOSPI"), indexChange("KOSDAQ")]);
    return NextResponse.json({ kospi, kosdaq });
  } catch {
    return NextResponse.json({ kospi: null, kosdaq: null }, { status: 502 });
  }
}
