/** Same-origin preview fallback; a configured independent service still takes priority. */
export function sanctuaryEntryUrl(ticker: string, origin: string | undefined): string | null {
 if (!/^\d{6}$/.test(ticker)) return null;
 return origin ? sanctuaryUrl(ticker, origin) : `/sanctuary-web/rooms/KRX/${ticker}`;
}
/** Public link contract: KRX ticker only. Never send portfolio or religious data. */
export function sanctuaryUrl(ticker: string, origin: string | undefined): string | null {
  if (!/^\d{6}$/.test(ticker) || !origin) return null;
  try {
    const base = new URL(origin);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
    if ((base.protocol !== 'https:' && !(local && base.protocol === 'http:')) ||
        base.username || base.password || base.search || base.hash || base.pathname !== '/') return null;
    return new URL(`/rooms/KRX/${ticker}`, base.origin).href;
  } catch { return null; }
}
