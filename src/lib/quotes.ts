import type { Dividend, Issue } from "./types";
import generatedQuotes from "../data/quotes.generated.json";

export type Quote = {
  ticker: string;
  name: string;
  sector: string;
  lastPrice: number;
  changePct: number;
  volume: number;
  dividend?: Dividend;
  issues?: Issue[];
};

const samsungDividend: Dividend = {
  expectedDate: "2027-11-20",
  confirmedDate: "2027-11-20",
  isConfirmed: true,
  lastAmount: 1446,
  yieldPct: 1.75,
  accruedHint: true,
};

const ktgDividend: Dividend = {
  expectedDate: "2027-12-15",
  isConfirmed: false,
  lastAmount: 1400,
  yieldPct: 5.2,
  accruedHint: true,
};

export const KOSPI_RETURN_5D = 1.8;

const HAND_QUOTES: Quote[] = [
  {
    ticker: "005930",
    name: "삼성전자",
    sector: "반도체",
    lastPrice: 82500,
    changePct: 1.24,
    volume: 18452310,
    dividend: samsungDividend,
    issues: [
      {
        type: "disclosure",
        title: "삼성전자, 분기 잠정실적 공시",
        source: "전자공시",
        publishedAt: "2026-09-26T16:10:00+09:00",
      },
      {
        type: "news",
        title: "삼성전자, 자사주 매입 결정 공시",
        source: "연합뉴스",
        publishedAt: "2026-09-24T09:20:00+09:00",
      },
    ],
  },
  {
    ticker: "000660",
    name: "SK하이닉스",
    sector: "반도체",
    lastPrice: 180000,
    changePct: -0.42,
    volume: 3921104,
    issues: [
      {
        type: "disclosure",
        title: "SK하이닉스, 시설투자 관련 공시",
        source: "전자공시",
        publishedAt: "2026-09-25T15:40:00+09:00",
      },
      {
        type: "news",
        title: "SK하이닉스, 정기 이사회 개최 안내",
        source: "한국경제",
        publishedAt: "2026-09-22T11:05:00+09:00",
      },
    ],
  },
  {
    ticker: "033780",
    name: "KT&G",
    sector: "필수소비재",
    lastPrice: 92000,
    changePct: -0.61,
    volume: 286441,
    dividend: ktgDividend,
    issues: [
      {
        type: "disclosure",
        title: "KT&G, 배당 관련 이사회 결정 공시",
        source: "전자공시",
        publishedAt: "2026-09-23T17:00:00+09:00",
      },
      {
        type: "news",
        title: "KT&G, 해외 법인 실적 자료 게시",
        source: "매일경제",
        publishedAt: "2026-09-19T08:50:00+09:00",
      },
    ],
  },
  quote("005380", "현대차", "자동차", 248000, 0.8, 912330),
  quote("000270", "기아", "자동차", 118500, -0.3, 1200440),
  quote("035420", "NAVER", "IT", 198000, 1.1, 640220),
  quote("035720", "카카오", "IT", 41200, -1.4, 2100330),
  quote("005490", "POSCO홀딩스", "철강", 392000, 0.2, 311200),
  quote("051910", "LG화학", "화학", 318000, -0.7, 188440),
  quote("006400", "삼성SDI", "에너지", 274500, 0.4, 266100),
  quote("068270", "셀트리온", "바이오", 176000, 0.9, 402880),
  quote("207940", "삼성바이오로직스", "바이오", 1012000, -0.2, 88440),
  quote("105560", "KB금융", "금융", 89200, 0.6, 990120, {
    expectedDate: "2027-11-12",
    isConfirmed: false,
    lastAmount: 2164,
    yieldPct: 3.4,
    accruedHint: true,
  }),
  quote("055550", "신한지주", "금융", 54800, 0.3, 870550),
  quote("096770", "SK이노베이션", "에너지", 112400, -1.1, 540220),
  quote("017670", "SK텔레콤", "통신", 56200, 0.1, 410330, {
    expectedDate: "2027-12-01",
    confirmedDate: "2027-12-01",
    isConfirmed: true,
    lastAmount: 1660,
    yieldPct: 4.1,
    accruedHint: true,
  }),
  quote("030200", "KT", "통신", 48950, -0.2, 388120),
  quote("003550", "LG", "지주", 78400, 0.5, 220440),
  quote("028260", "삼성물산", "지주", 142000, 0.2, 166880),
  quote("139480", "이마트", "유통", 68500, -0.8, 144220),
  quote("004170", "신세계", "유통", 168000, 0.4, 99210),
  quote("090430", "아모레퍼시픽", "필수소비재", 124500, 1.3, 210440),
  quote("271560", "오리온", "필수소비재", 108000, 0.2, 188330, {
    expectedDate: "2027-10-30",
    isConfirmed: false,
    lastAmount: 1250,
    yieldPct: 1.4,
  }),
  quote("097950", "CJ제일제당", "필수소비재", 246000, -0.5, 77220),
];

function mergeQuotes(): Quote[] {
  const byTicker = new Map<string, Quote>();
  for (const item of generatedQuotes as Quote[]) byTicker.set(item.ticker, item);
  for (const item of HAND_QUOTES) {
    const current = byTicker.get(item.ticker);
    byTicker.set(item.ticker, current ? { ...item, ...current, dividend: item.dividend, issues: item.issues } : item);
  }
  return [...byTicker.values()];
}

export const QUOTES: Quote[] = mergeQuotes();

function quote(
  ticker: string,
  name: string,
  sector: string,
  lastPrice: number,
  changePct: number,
  volume: number,
  dividend?: Dividend,
): Quote {
  return { ticker, name, sector, lastPrice, changePct, volume, dividend };
}

export function getQuote(ticker: string): Quote | undefined {
  return QUOTES.find((item) => item.ticker === ticker.trim());
}

export function searchQuotes(query: string): Quote[] {
  const text = query.trim();
  if (!text) return QUOTES.slice(0, 8);
  return QUOTES.filter(
    (item) => item.ticker.includes(text) || item.name.includes(text),
  ).slice(0, 12);
}

export function quoteRecord(): Record<string, Quote> {
  return Object.fromEntries(QUOTES.map((item) => [item.ticker, item]));
}
