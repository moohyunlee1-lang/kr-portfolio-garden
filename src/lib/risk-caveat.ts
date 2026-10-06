import report from "../data/kosdaq-risk-garden-report.json";

export const RISK_GARDEN_ID = "kosdaq_delisting_risk";

export function riskGardenNotice(gardenId: string): string | null {
  if (gardenId !== RISK_GARDEN_ID) return null;
  return `${report.membership_as_of} KIND 관리종목 ${report.membership_count}개 중 ${report.reference_date} 거래 종가 확인 ${report.planted}개만 가상 식재. 당일 거래 없는 ${Object.keys(report.skipped).length}개 제외. 식재 종목 중 ${report.designated_after_reference_day.filter((ticker) => ticker in report.observations).length}개는 식재일 이후 지정. 당시 관리종목 전체 명단이 아닙니다.`;
}

export function riskPositionNotice(gardenId: string, ticker: string): string | null {
  if (gardenId !== RISK_GARDEN_ID) return null;
  const later = report.designated_after_reference_day.includes(ticker);
  return `${report.reference_date} 종가와 종목당 1천만 원 예산으로 계산한 가상 보유입니다. 실제 매수·평가손익이 아닙니다. ${report.membership_as_of} 관리종목 명단 기준입니다.${later ? ` 이 종목은 식재일 이후 (${report.membership[ticker as keyof typeof report.membership]?.management_date ?? "날짜 미상"}) 관리종목으로 지정됐습니다.` : ""}`;
}
