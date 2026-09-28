import { NextResponse } from "next/server";
import { fillIndexes } from "@/lib/market/chain";
import { defaultProviders } from "@/lib/market/providers";

export const revalidate = 60;

export async function GET() {
  try {
    const result = await fillIndexes(defaultProviders());
    return NextResponse.json({ changePct: result.kospi, source: result.source.kospi ?? null });
  } catch {
    return NextResponse.json({ changePct: null }, { status: 502 });
  }
}
