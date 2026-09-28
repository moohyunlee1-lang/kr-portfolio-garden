const SEOUL = "Asia/Seoul";

function seoulParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SEOUL,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: lookup.weekday ?? "",
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
  };
}

export function inKrxHours(now: Date): boolean {
  const { weekday, hour, minute } = seoulParts(now);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const stamp = hour * 60 + minute;
  return stamp >= 8 * 60 + 50 && stamp < 16 * 60;
}

export function shouldPoll(now: Date, hidden: boolean): boolean {
  return !hidden && inKrxHours(now);
}

export const POLL_MS = 60_000;
export const QUOTE_BATCH_LIMIT = 80;
