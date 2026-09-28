import { NextResponse } from "next/server";
import { fillIndexes } from "@/lib/market/chain";
import { defaultProviders } from "@/lib/market/providers";

export const revalidate = 60;

export async function GET() {
  try {
    const result = await fillIndexes(defaultProviders());
    return NextResponse.json({
      kospi: result.kospi,
      kosdaq: result.kosdaq,
      source: result.source,
    });
  } catch {
    return NextResponse.json({ kospi: null, kosdaq: null, source: {} }, { status: 502 });
  }
}
