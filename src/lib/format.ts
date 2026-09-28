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
