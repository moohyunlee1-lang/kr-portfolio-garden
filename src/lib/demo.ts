import type { StoredGarden } from "./types";

export function createSampleGarden(id: string): StoredGarden {
  return {
    id,
    name: "샘플 정원",
    sample: true,
    positions: [
      {
        id: "sample-005930",
        gardenId: id,
        plotIndex: 12,
        ticker: "005930",
        name: "삼성전자",
        sector: "반도체",
        quantity: 12,
        avgCost: 55000,
        purchasedAt: "2024-01-10",
      },
      {
        id: "sample-000660",
        gardenId: id,
        plotIndex: 13,
        ticker: "000660",
        name: "SK하이닉스",
        sector: "반도체",
        quantity: 4,
        avgCost: 150000,
        purchasedAt: "2024-06-01",
      },
      {
        id: "sample-033780",
        gardenId: id,
        plotIndex: 14,
        ticker: "033780",
        name: "KT&G",
        sector: "필수소비재",
        quantity: 3,
        avgCost: 100000,
        purchasedAt: "2024-03-01",
      },
    ],
  };
}
