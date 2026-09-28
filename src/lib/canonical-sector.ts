export const SECTOR_ORDER = [
  "반도체",
  "2차전지",
  "바이오",
  "로봇",
  "조선",
  "방산",
  "원전",
  "자동차",
  "화장품",
] as const;

/** Home sector when a ticker is only a side character in other chains. */
export const CANONICAL_SECTOR: Record<string, string> = {
  "005930": "반도체",
  "005935": "반도체",
  "000660": "반도체",
  "006400": "2차전지",
  "051910": "2차전지",
  "373220": "2차전지",
  "096770": "2차전지",
  "207940": "바이오",
  "068270": "바이오",
  "326030": "바이오",
  "005380": "자동차",
  "000270": "자동차",
  "012330": "자동차",
  "009540": "조선",
  "010140": "조선",
  "329180": "조선",
  "267250": "조선",
  "012450": "방산",
  "047810": "방산",
  "079550": "방산",
};

const INDIRECT = /지분|간접|확인보류|코넥스|KONEX/;

export function isIndirectGardenName(name: string): boolean {
  return INDIRECT.test(name);
}

export function canonicalSector(
  ticker: string,
  gardenNames: string[],
  fallback?: string,
): string {
  const home = CANONICAL_SECTOR[ticker];
  if (home) return home;
  const sectors = gardenNames.map((name) => name.split(" · ")[0]?.trim()).filter(Boolean);
  const core = gardenNames
    .filter((name) => !isIndirectGardenName(name))
    .map((name) => name.split(" · ")[0]?.trim())
    .filter(Boolean);
  const pool = core.length ? core : sectors;
  for (const sector of SECTOR_ORDER) {
    if (pool.includes(sector)) return sector;
  }
  return fallback || pool[0] || sectors[0] || "기타";
}
