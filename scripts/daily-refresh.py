#!/usr/bin/env python3
"""Daily lastPrice/changePct/volume refresh: KIS → Yahoo → pykrx → Naver, then keep enrich scripts separate."""

from __future__ import annotations

import json
import os
import ssl
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "quotes.generated.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()
KIS_BASE = os.environ.get("KIS_BASE_URL", "https://openapi.koreainvestment.com:9443").rstrip("/")


def http_json(url: str, headers: dict | None = None, data: bytes | None = None, method: str | None = None) -> dict | None:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=18, context=CTX) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except Exception:
        return None


def num(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if value == value else None
    text = str(value).replace(",", "").strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def kis_token() -> str | None:
    key = os.environ.get("KIS_APP_KEY", "").strip()
    secret = os.environ.get("KIS_APP_SECRET", "").strip()
    if not key or not secret:
        return None
    body = json.dumps({"grant_type": "client_credentials", "appkey": key, "appsecret": secret}).encode()
    data = http_json(f"{KIS_BASE}/oauth2/tokenP", {"content-type": "application/json"}, body, "POST")
    token = (data or {}).get("access_token")
    return str(token) if token else None


def kis_quote(token: str, ticker: str) -> dict | None:
    key = os.environ.get("KIS_APP_KEY", "").strip()
    secret = os.environ.get("KIS_APP_SECRET", "").strip()
    query = urllib.parse.urlencode({"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker})
    data = http_json(
        f"{KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?{query}",
        {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "appkey": key,
            "appsecret": secret,
            "tr_id": "FHKST01010100",
            "custtype": "P",
        },
    )
    output = (data or {}).get("output") if (data or {}).get("rt_cd") == "0" else None
    if not isinstance(output, dict):
        return None
    last = num(output.get("stck_prpr"))
    change = num(output.get("prdy_ctrt"))
    volume = num(output.get("acml_vol")) or 0
    if last and last > 0 and change is not None:
        return {"lastPrice": last, "changePct": change, "volume": volume, "source": "kis"}
    return None


def yahoo_quote(ticker: str) -> dict | None:
    for suffix in (".KS", ".KQ"):
        data = http_json(f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}{suffix}?interval=1d&range=5d")
        meta = ((data or {}).get("chart") or {}).get("result") or []
        if not meta:
            continue
        info = meta[0].get("meta") or {}
        if str(info.get("instrumentType") or "").upper() != "EQUITY":
            continue
        last = num(info.get("regularMarketPrice"))
        prev = num(info.get("chartPreviousClose")) or num(info.get("previousClose"))
        volume = num(info.get("regularMarketVolume")) or 0
        change = num(info.get("regularMarketChangePercent"))
        if last and last > 0:
            if change is None and prev and prev > 0:
                change = (last - prev) / prev * 100
            return {"lastPrice": last, "changePct": change or 0, "volume": volume, "source": "yahoo"}
    return None


def pykrx_quote(ticker: str) -> dict | None:
    try:
        from pykrx import stock  # type: ignore
    except Exception:
        return None
    from datetime import datetime, timedelta, timezone
    kst = timezone(timedelta(hours=9))
    for back in range(0, 6):
        day = (datetime.now(kst) - timedelta(days=back)).strftime("%Y%m%d")
        try:
            frame = stock.get_market_ohlcv(day, day, ticker)
        except Exception:
            continue
        if frame is None or getattr(frame, "empty", True):
            continue
        row = frame.iloc[-1]
        close = float(row.get("종가") or 0)
        volume = float(row.get("거래량") or 0)
        if close > 0:
            return {"lastPrice": close, "changePct": 0, "volume": volume, "source": "pykrx"}
    return None


def naver_quote(ticker: str) -> dict | None:
    data = http_json(
        f"https://m.stock.naver.com/api/stock/{ticker}/basic",
        {"Referer": "https://m.stock.naver.com/"},
    )
    if not data:
        data = http_json(f"https://api.finance.naver.com/service/itemSummary.nhn?itemcode={ticker}")
    if not data:
        return None
    last = num(data.get("closePrice")) or num(data.get("now"))
    change = num(data.get("fluctuationsRatio")) or num(data.get("rate"))
    volume = num(data.get("accumulatedTradingVolume")) or num(data.get("quant")) or 0
    if last and last > 0 and change is not None:
        return {"lastPrice": last, "changePct": change, "volume": volume, "source": "naver"}
    return None


def one(ticker: str, token: str | None) -> dict | None:
    if token:
        hit = kis_quote(token, ticker)
        if hit:
            return hit
    for fn in (yahoo_quote, pykrx_quote, naver_quote):
        hit = fn(ticker)
        if hit:
            return hit
        time.sleep(0.05)
    return None


def main() -> None:
    quotes = json.loads(OUT.read_text(encoding="utf-8"))
    tickers = [row["ticker"] for row in quotes if row.get("ticker")]
    token = kis_token()
    found: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {pool.submit(one, ticker, token): ticker for ticker in tickers}
        done = 0
        for fut in as_completed(futs):
            ticker = futs[fut]
            done += 1
            if done % 80 == 0:
                print(f"live {done}/{len(tickers)}")
            found[ticker] = fut.result() or {}
    filled = 0
    sources: dict[str, int] = {}
    for row in quotes:
        hit = found.get(row["ticker"])
        if not hit:
            continue
        row["lastPrice"] = hit["lastPrice"]
        row["changePct"] = hit["changePct"]
        row["volume"] = hit["volume"]
        filled += 1
        sources[hit["source"]] = sources.get(hit["source"], 0) + 1
    OUT.write_text(json.dumps(quotes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"filled": filled, "total": len(quotes), "sources": sources}))


if __name__ == "__main__":
    main()
