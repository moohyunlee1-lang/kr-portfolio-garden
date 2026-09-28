import { asNumber } from "../chain";
import { mapPool } from "../pool";
import type { IndexMove, LiveQuote, QuoteProvider } from "../types";

type Env = NodeJS.ProcessEnv | {
  KIS_APP_KEY?: string;
  KIS_APP_SECRET?: string;
  KIS_BASE_URL?: string;
};

type Token = { access: string; expiresAt: number };

const tokenCache = new Map<string, Token>();

function config(env: Env) {
  const appKey = env.KIS_APP_KEY?.trim();
  const appSecret = env.KIS_APP_SECRET?.trim();
  if (!appKey || !appSecret) return null;
  return {
    appKey,
    appSecret,
    base: (env.KIS_BASE_URL || "https://openapi.koreainvestment.com:9443").replace(/\/$/, ""),
  };
}

async function token(env: Env, fetchImpl: typeof fetch): Promise<string | null> {
  const cfg = config(env);
  if (!cfg) return null;
  const cached = tokenCache.get(cfg.appKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.access;
  const response = await fetchImpl(`${cfg.base}/oauth2/tokenP`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: cfg.appKey,
      appsecret: cfg.appSecret,
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  tokenCache.set(cfg.appKey, {
    access: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 86400) * 1000,
  });
  return data.access_token;
}

async function kisGet(
  env: Env,
  fetchImpl: typeof fetch,
  path: string,
  trId: string,
  query: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const cfg = config(env);
  const access = await token(env, fetchImpl);
  if (!cfg || !access) return null;
  const url = new URL(path, `${cfg.base}/`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetchImpl(url, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${access}`,
      appkey: cfg.appKey,
      appsecret: cfg.appSecret,
      tr_id: trId,
      custtype: "P",
    },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { rt_cd?: string; output?: Record<string, unknown> };
  if (data.rt_cd !== "0" || !data.output) return null;
  return data.output;
}

function quoteFromOutput(ticker: string, output: Record<string, unknown>): LiveQuote | null {
  const lastPrice = asNumber(output.stck_prpr);
  const changePct = asNumber(output.prdy_ctrt);
  const volume = asNumber(output.acml_vol) ?? 0;
  if (!(lastPrice && lastPrice > 0) || changePct == null) return null;
  return { ticker, lastPrice, changePct, volume };
}

export function createKisProvider(
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): QuoteProvider {
  return {
    name: "kis",
    async quotes(tickers) {
      if (!config(env)) return [];
      const rows = await mapPool(tickers, 3, async (ticker) => {
        const output = await kisGet(env, fetchImpl, "/uapi/domestic-stock/v1/quotations/inquire-price", "FHKST01010100", {
          FID_COND_MRKT_DIV_CODE: "J",
          FID_INPUT_ISCD: ticker,
        });
        return output ? quoteFromOutput(ticker, output) : null;
      });
      return rows.filter((row): row is LiveQuote => Boolean(row));
    },
    async indexes(): Promise<IndexMove> {
      if (!config(env)) return { kospi: null, kosdaq: null };
      const [kospiOut, kosdaqOut] = await Promise.all([
        kisGet(env, fetchImpl, "/uapi/domestic-stock/v1/quotations/inquire-index-price", "FHPUP02100000", {
          FID_COND_MRKT_DIV_CODE: "U",
          FID_INPUT_ISCD: "0001",
        }),
        kisGet(env, fetchImpl, "/uapi/domestic-stock/v1/quotations/inquire-index-price", "FHPUP02100000", {
          FID_COND_MRKT_DIV_CODE: "U",
          FID_INPUT_ISCD: "1001",
        }),
      ]);
      return {
        kospi: asNumber(kospiOut?.bstp_nmix_prdy_ctrt),
        kosdaq: asNumber(kosdaqOut?.bstp_nmix_prdy_ctrt),
      };
    },
  };
}
