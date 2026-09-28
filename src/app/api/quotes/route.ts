import { NextResponse } from "next/server";
import { fillQuotes, parseTickerQuery } from "@/lib/market/chain";
import { defaultProviders } from "@/lib/market/providers";

export const revalidate = 30;

export async function GET(request: Request) {
  const tickers = parseTickerQuery(new URL(request.url).searchParams.get("tickers"));
  if (!tickers.length) {
    return NextResponse.json({ quotes: [], source: {} });
  }
  try {
    const result = await fillQuotes(tickers, defaultProviders());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ quotes: [], source: {} }, { status: 502 });
  }
}
