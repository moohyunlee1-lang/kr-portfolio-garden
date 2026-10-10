import { parseTickers, researchFor } from "../../../lib/dashboard-research";
export async function GET(request: Request) {
  const tickers = parseTickers(
    new URL(request.url).searchParams.get("tickers") ?? "",
  );
  if (!tickers)
    return Response.json(
      { error: "1~20개의 유효한 종목코드가 필요합니다." },
      { status: 400 },
    );
  return Response.json(await researchFor(tickers), {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
