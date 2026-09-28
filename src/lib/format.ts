export function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function formatSignedMoney(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ko-KR")}원`;
}

export function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(volume: number): string {
  return `${Math.round(volume).toLocaleString("ko-KR")}주`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${year}.${month}.${day}`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function formatMarketCap(won: number | null | undefined): string {
  if (won == null || !Number.isFinite(won) || won <= 0) return "—";
  if (won >= 1e12) {
    const jo = won / 1e12;
    return `${(jo >= 100 ? jo.toFixed(0) : jo.toFixed(1)).replace(/\.0$/, "")}조원`;
  }
  if (won >= 1e8) {
    const eok = won / 1e8;
    return `${(eok >= 100 ? eok.toFixed(0) : eok.toFixed(1)).replace(/\.0$/, "")}억원`;
  }
  return `${Math.round(won).toLocaleString("ko-KR")}원`;
}

export function formatMultiple(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}배`;
}

export function formatWonOrDash(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export const STAGE_LABEL = {
  seed: "씨앗",
  sprout: "새싹",
  sapling: "묘목",
  tree: "나무",
  lush: "무성한 나무",
} as const;

export const WEATHER_LABEL = {
  bull: "햇빛",
  neutral: "구름",
  bear: "비바람",
} as const;
