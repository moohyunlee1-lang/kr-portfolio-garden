#!/usr/bin/env python3
"""Attach Naver PER/PBR/EPS/market cap and debt-per-share onto quotes.generated.json."""

from __future__ import annotations

import json
import ssl
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "quotes.generated.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()


def fetch(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://m.stock.naver.com/"})
    try:
        with urllib.request.urlopen(req, timeout=18, context=CTX) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except Exception:
        return None


def num(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if value != value:  # NaN
            return None
        return float(value)
    text = str(value).replace(",", "").replace("%", "").replace("배", "").replace("원", "").strip()
    if not text or text in {"-", "N/A"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def latest_actual(columns: dict, titles: list) -> float | None:
    actual = [t["key"] for t in titles if t.get("isConsensus") != "Y"]
    for key in reversed(actual):
        cell = (columns or {}).get(key) or {}
        parsed = num(cell.get("value"))
        if parsed is not None:
            return parsed
    return None


def fundamentals(ticker: str) -> dict:
    summary = fetch(f"https://api.finance.naver.com/service/itemSummary.nhn?itemcode={quote(ticker)}") or {}
    annual = fetch(f"https://m.stock.naver.com/api/stock/{quote(ticker)}/finance/annual") or {}
    info = annual.get("financeInfo") or {}
    titles = info.get("trTitleList") or []
    rows = {row.get("title"): row.get("columns") or {} for row in info.get("rowList") or []}
    market_sum = num(summary.get("marketSum"))  # million KRW
    bps = latest_actual(rows.get("BPS"), titles)
    debt_ratio = latest_actual(rows.get("부채비율"), titles)
    debt_ps = None
    if bps is not None and debt_ratio is not None and bps > 0 and debt_ratio >= 0:
        debt_ps = round(bps * debt_ratio / 100, 2)
    return {
        "marketCap": None if market_sum is None else int(market_sum * 1_000_000),
        "per": num(summary.get("per")),
        "pbr": num(summary.get("pbr")),
        "eps": num(summary.get("eps")),
        "bps": bps,
        "debtRatioPct": debt_ratio,
        "debtPerShare": debt_ps,
    }


def main() -> None:
    quotes = json.loads(OUT.read_text(encoding="utf-8"))
    tickers = [row["ticker"] for row in quotes]
    found: dict[str, dict] = {}
    failed = 0
    with ThreadPoolExecutor(max_workers=10) as pool:
        futs = {pool.submit(fundamentals, t): t for t in tickers}
        done = 0
        for fut in as_completed(futs):
            ticker = futs[fut]
            done += 1
            if done % 100 == 0:
                print(f"fundamentals {done}/{len(tickers)}")
            try:
                found[ticker] = fut.result()
            except Exception:
                failed += 1
                found[ticker] = {
                    "marketCap": None,
                    "per": None,
                    "pbr": None,
                    "eps": None,
                    "bps": None,
                    "debtRatioPct": None,
                    "debtPerShare": None,
                }
    for row in quotes:
        row.update(found.get(row["ticker"], {}))
    OUT.write_text(json.dumps(quotes, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = sum(1 for row in quotes if row.get("marketCap"))
    dps = sum(1 for row in quotes if row.get("debtPerShare") is not None)
    print(json.dumps({"quotes": len(quotes), "withMarketCap": ok, "withDebtPerShare": dps, "failed": failed}))


if __name__ == "__main__":
    main()
