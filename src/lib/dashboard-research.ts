import snapshot from "../data/dashboard-disclosures.v1.json";
export type ResearchItem = {
  type: string;
  title: string;
  url: string;
  publishedAt: string;
  source: string;
};
export type StockResearch = {
  ticker: string;
  disclosures: ResearchItem[];
  news: ResearchItem[];
  newsStatus: "ok" | "empty" | "unavailable";
};
export type Research = {
  generatedAt: string;
  fetchedAt: string;
  sources: typeof snapshot.sources;
  policy: string;
  stocks: StockResearch[];
};
export function parseTickers(value: string): string[] | null {
  const codes = value.split(",");
  if (
    !codes.length ||
    codes.length > 20 ||
    codes.some((c) => !/^[0-9A-Z]{6}$/.test(c))
  )
    return null;
  return [...new Set(codes)];
}
export function parseNews(data: unknown): ResearchItem[] {
  if (!Array.isArray(data)) throw new Error("Invalid news response");
  const result: ResearchItem[] = [];
  for (const group of data)
    for (const row of Array.isArray(group?.items) ? group.items : []) {
      if (
        typeof row.title !== "string" ||
        typeof row.mobileNewsUrl !== "string" ||
        !/^https:\/\/n\.news\.naver\.com\//.test(row.mobileNewsUrl)
      )
        continue;
      const d = String(row.datetime ?? "");
      result.push({
        type: "news",
        title: row.title
          .replace(/<[^>]*>/g, "")
          .replace(
            /&(quot|amp|lt|gt|apos|nbsp);/g,
            (_: string, entity: string) =>
              (
                ({
                  quot: '"',
                  amp: "&",
                  lt: "<",
                  gt: ">",
                  apos: "'",
                  nbsp: " ",
                }) as Record<string, string>
              )[entity] ?? _,
          )
          .slice(0, 300),
        url: row.mobileNewsUrl,
        publishedAt: /^\d{12}$/.test(d)
          ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(8, 10)}:${d.slice(10, 12)}:00+09:00`
          : "날짜 미제공",
        source: String(row.officeName ?? "Naver 뉴스"),
      });
    }
  return [...new Map(result.map((r) => [r.url, r])).values()].slice(0, 3);
}
export async function researchFor(
  tickers: string[],
  request: typeof fetch = fetch,
): Promise<Research> {
  const stocks: StockResearch[] = [];
  let next = 0;
  async function worker() {
    while (next < tickers.length) {
      const ticker = tickers[next++];
      const row: StockResearch = {
        ticker,
        disclosures: snapshot.items.filter((i) => i.ticker === ticker),
        news: [],
        newsStatus: "unavailable",
      };
      try {
        const response = await request(
          `https://m.stock.naver.com/api/news/stock/${ticker}?pageSize=3&page=1`,
          {
            signal: AbortSignal.timeout(8000),
            headers: { "User-Agent": "Mozilla/5.0" },
          },
        );
        if (!response.ok) throw new Error("News unavailable");
        row.news = parseNews(await response.json());
        row.newsStatus = row.news.length ? "ok" : "empty";
      } catch {
        /* keep local disclosures even if the news API is down */
      }
      stocks.push(row);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(3, tickers.length) }, () => worker()),
  );
  return {
    generatedAt: snapshot.generatedAt,
    fetchedAt: new Date().toISOString(),
    sources: snapshot.sources,
    policy: snapshot.policy,
    stocks: tickers.map((t) => stocks.find((s) => s.ticker === t)!),
  };
}
