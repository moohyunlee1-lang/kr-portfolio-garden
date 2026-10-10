import snapshot from "../data/representative-industries.v1.json";

export const UNCLASSIFIED_INDUSTRY = "미분류·검토 필요";
export type IndustryRecord = {
  ticker: string;
  providerName: string | null;
  market: string | null;
  rawIndustry: string | null;
  rawIndustryCode: string | null;
  products: string | null;
  name: string;
  representativeIndustry: string;
  subsector: string | null;
  candidateIndustry: string | null;
  themes: string[];
  sourceUrl: string;
  source: string;
  fetchedAt: string;
  providerAsOf: string | null;
  status: string;
  confidence: string;
  reason: string;
};
export const industryRecords: Record<string, IndustryRecord> = snapshot.records;
export const representativeIndustries: Record<string, string> = Object.fromEntries(
  Object.entries(industryRecords).map(([ticker, row]) => [ticker, row.representativeIndustry]),
);
export const industryNotice = `대표업종: KRX KIND 상장법인목록 수집 ${snapshot.fetchedAt} · taxonomy v${snapshot.taxonomyVersion}. 공식 업종을 집계용으로 통합한 분류이며 최신 주력사업 검증이 아닙니다. 세부업종은 공급자 원문, 테마는 기존 밸류체인 복수 소속을 보존합니다. 업종 유효일·원문 코드 미제공. 명칭 불일치·모호한 지주·목록 미등재는 미분류·검토 필요. 삼성전자는 KIND 통신·방송장비 업종으로 집계하며 반도체 투자테마와 구별합니다.`;
