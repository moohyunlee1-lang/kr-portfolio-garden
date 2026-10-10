import {
  descending,
  money,
  percent,
  rankedStocks,
  type Dashboard,
} from "./dashboard";
import type { Research } from "./dashboard-research";
import { industryRecords, industryNotice } from "./representative-industry";
export type ReportRow = { text: string; url?: string };
export type ReportSection = { title: string; rows: ReportRow[] };
export function reportSections(
  d: Dashboard,
  sector?: string,
  research?: Research,
  priceNotice = "",
): ReportSection[] {
  const selected = d.sectors.find((s) => s.name === sector);
  const total = selected ?? d;
  const sections: ReportSection[] = [
    {
      title: sector ? `섹터 분석 · ${sector}` : "정원 대시보드",
      rows: [
        {
          text: `총평가액 ${money(total.marketValue)} · 평가손익 ${money(total.profit)} · 총수익률 ${percent(total.returnPct)}`,
        },
        {
          text: `매수원금 ${money(total.cost)} · ${selected ? selected.stocks.length : d.stocks.length}종목${selected ? "" : ` · ${d.sectors.length}섹터`}`,
        },
        {
          text: "수익률 = (현재 평가액 − 실제 식재 매수원금) / 매수원금. 배당·수수료·세금 제외. 금액 단위: 억원, 소수 둘째 자리.",
        },
        {
          text: "시세 미확인 종목이 있으면 합계·손익·비중은 —. 원금 0의 수익률은 —. 미확인 수익률은 순위 제외.",
        },
        { text: priceNotice || "생성 시점의 정원 시세 사본 · 자동 갱신 없음" },
      ],
    },
  ];
  if (selected) {
    sections[0].rows.push({text: `부모 정원 ${d.name} · 정원 내 비중 ${percent(selected.weightPct)} · 아래 종목 비중은 선택 섹터 평가액 기준`});
    sections.push({
      title: "전체 종목 상세",
      rows: selected.stocks.map(s => ({text: `${s.name} (${s.ticker}) · ${s.sector} · 수량 ${s.quantity} · 원금 ${money(s.cost)} · 평가액 ${money(s.marketValue)} · 섹터 내 비중 ${percent(selected.marketValue && s.marketValue != null ? s.marketValue / selected.marketValue * 100 : null)} · 수익률 ${percent(s.returnPct)} · 손익 ${money(s.profit)}`})),
    });
    sections.push({
      title: "종목 비중 · 평가액 내림차순",
      rows: [...selected.stocks]
        .sort((a, b) => descending(a.marketValue, b.marketValue))
        .map((s) => ({
          text: `${s.name} (${s.ticker}) · 비중 ${percent(selected.marketValue && s.marketValue != null ? (s.marketValue / selected.marketValue) * 100 : null)} · 평가액 ${money(s.marketValue)}`,
        })),
    });
    sections.push({
      title: "종목 수익률 · 내림차순",
      rows: [...selected.stocks]
        .sort((a, b) => descending(a.returnPct, b.returnPct))
        .map((s) => ({
          text: `${s.name} (${s.ticker}) · 수익률 ${percent(s.returnPct)} · 손익 ${money(s.profit)} · 평가액 ${money(s.marketValue)}`,
        })),
    });
    for (const stock of selected.stocks) {
      const item = research?.stocks.find((r) => r.ticker === stock.ticker);
      sections.push({
        title: `공시·뉴스 · ${stock.name} (${stock.ticker})`,
        rows: [
          ...(item?.disclosures.length
            ? item.disclosures.map((i) => ({
                text: `공시 | ${i.publishedAt} · ${i.title} · ${i.source}`,
                url: i.url,
              }))
            : [
                {
                  text: item
                    ? "공시: 게시 스냅샷에 기록 없음 (공시가 없다는 뜻 아님)"
                    : "공시: 미조회/조회실패",
                },
              ]),
          ...(item?.news.length
            ? item.news.map((i) => ({
                text: `뉴스 | ${i.publishedAt} · ${i.title} · ${i.source}`,
                url: i.url,
              }))
            : [
                {
                  text: `뉴스: ${!item || item.newsStatus === "unavailable" ? "조회 실패/미조회" : "API 결과 없음"}`,
                },
              ]),
        ],
      });
    }
    sections.push({
      title: "공시·뉴스 출처와 한계",
      rows: research
        ? [
            {
              text: `공시 스냅샷 생성 ${research.generatedAt} · 뉴스 조회 ${research.fetchedAt}`,
            },
            ...research.sources.map((s) => ({
              text: `${s.name} · DB 최신 공시일 ${s.latestFilingDate ?? "미상"} · 확인 ${s.rowsExamined}건`,
            })),
            { text: research.policy },
            {
              text: "로컬 DB 공개 메타데이터를 버전 스냅샷으로 게시. 서버가 로컬 디스크를 읽지 않습니다. 날짜가 오래된 공시는 최근 공시가 아닙니다. 뉴스는 Naver 종목 뉴스 API 최신 3개 제목이며 중요도·정확성을 보장하지 않습니다.",
            },
          ]
        : [{ text: "자료 미조회/조회 실패 · 최근 공시의 완전성 확인 불가" }],
    });
  } else {
    sections.push({
      title: "섹터 비중 · 평가액 내림차순",
      rows: d.sectors.map((s) => ({
        text: `${s.name} · ${s.stocks.length}종목 · 비중 ${percent(s.weightPct)} · 평가액 ${money(s.marketValue)}`,
      })),
    });
    sections.push({
      title: "섹터 수익률 · 내림차순",
      rows: [...d.sectors]
        .sort((a, b) => descending(a.returnPct, b.returnPct))
        .map((s) => ({
          text: `${s.name} · 수익률 ${percent(s.returnPct)} · 손익 ${money(s.profit)} · 원금 ${money(s.cost)}`,
        })),
    });
    sections.push({
      title: "종목 상위30·하위30 · 중복 없이 (60종목 이하는 전체 순위)",
      rows: rankedStocks(d.stocks).map((s) => ({
        text: `${s.rank}위 ${s.name} (${s.ticker}) · ${s.sector} · 수익률 ${percent(s.returnPct)} · 손익 ${money(s.profit)}`,
      })),
    });
    sections.push({
      title: "전체 종목 상세",
      rows: d.stocks.map((s) => ({
        text: `${s.name} (${s.ticker}) · ${s.sector} · 수량 ${s.quantity} · 원금 ${money(s.cost)} · 평가액 ${money(s.marketValue)} · 비중 ${percent(s.weightPct)} · 수익률 ${percent(s.returnPct)} · 손익 ${money(s.profit)}`,
      })),
    });
  }
  sections.push({ title: "대표업종 분류 정책", rows: [{ text: industryNotice }] });
  sections.push({
    title: "대표업종 분류 근거 · 전체 종목",
    rows: (selected?.stocks ?? d.stocks).map((stock) => {
      const row = industryRecords[stock.ticker];
      return {
        text: row
          ? `${stock.name} (${stock.ticker}) · 대표업종 ${row.representativeIndustry} · 세부업종 ${row.subsector ?? "미제공"} · 공급자명 ${row.providerName ?? "미등재"} · 원문코드 ${row.rawIndustryCode ?? "미제공"} · 테마 ${row.themes.join(", ") || "기존 소속 없음"} · ${row.status}/${row.confidence} · ${row.reason} · 수집 ${row.fetchedAt} · 업종 유효일 미제공`
          : `${stock.name} (${stock.ticker}) · 분류 스냅샷 미등재 · 미분류·검토 필요 · 테마 미확인`,
        url: row?.sourceUrl,
      };
    }),
  });
  return sections;
}
export function reportPages(
  sections: ReportSection[],
  size = 7,
): ReportSection[] {
  return sections.flatMap((section) =>
    Array.from(
      { length: Math.max(1, Math.ceil(section.rows.length / size)) },
      (_, i) => ({
        title:
          section.title +
          (section.rows.length > size
            ? ` · ${i + 1}/${Math.ceil(section.rows.length / size)}`
            : ""),
        rows: section.rows.slice(i * size, (i + 1) * size),
      }),
    ),
  );
}
const mdEscape = (value: string) =>
  value.replace(/[\\`*_{}\[\]<>#|]/g, "\\$&").replace(/\r?\n/g, " ");
export function reportMarkdown(d: Dashboard, sections: ReportSection[]) {
  return (
    `# 그루밭 · ${mdEscape(d.name)}\n\n스냅샷: ${d.createdAt}\n\n` +
    sections
      .map(
        (s) =>
          `## ${mdEscape(s.title)}\n\n` +
          s.rows
            .map(
              (r) =>
                `- ${mdEscape(r.text)}${r.url ? ` ([원문](${r.url}))` : ""}`,
            )
            .join("\n"),
      )
      .join("\n\n") +
    "\n"
  );
}
