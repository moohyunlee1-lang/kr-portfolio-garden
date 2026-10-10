import { expect, it, vi } from "vitest";
import { researchFor, parseNews, parseTickers } from "./dashboard-research";
it("validates bounded alphanumeric ticker requests", () => {
  expect(parseTickers("005930,000660,005930")).toEqual(["005930", "000660"]);
  expect(parseTickers("../bad")).toBeNull();
  expect(parseTickers("00593a")).toBeNull();
  expect(
    parseTickers(
      Array.from({ length: 21 }, (_, i) => String(i).padStart(6, "0")).join(
        ",",
      ),
    ),
  ).toBeNull();
});
it("only exposes safe linked news headlines, never bodies", () => {
  expect(
    parseNews([
      {
        items: [
          { title: "<b>실적</b>", mobileNewsUrl: "javascript:alert(1)" },
          {
            title: "&quot;실적&quot; &amp; 전망",
            mobileNewsUrl: "https://n.news.naver.com/mnews/article/001/1",
            datetime: "202610091200",
            officeName: "언론",
            body: "private",
          },
        ],
      },
    ]),
  ).toEqual([
    {
      type: "news",
      title: '"실적" & 전망',
      url: "https://n.news.naver.com/mnews/article/001/1",
      publishedAt: "2026-10-09T12:00:00+09:00",
      source: "언론",
    },
  ]);
});
it("reads local published disclosure snapshot first and reports news failure distinctly", async () => {
  const request = vi.fn().mockRejectedValue(new Error("offline"));
  const result = await researchFor(["005930"], request);
  expect(result.generatedAt).toBeTruthy();
  expect(result.sources.length).toBe(2);
  expect(result.stocks[0].ticker).toBe("005930");
  expect(result.stocks[0].newsStatus).toBe("unavailable");
  expect(result.stocks[0].disclosures).toBeInstanceOf(Array);
  expect(request).toHaveBeenCalledTimes(1);
});
