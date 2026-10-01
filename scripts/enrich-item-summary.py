#!/usr/bin/env python3
"""Fill marketCap/PER/PBR/EPS from Naver itemSummary onto quotes.generated.json."""

from __future__ import annotations

import json
import time
import ssl
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "quotes.generated.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()


def fetch_summary(ticker: str) -> dict | None:
    url = f"https://api.finance.naver.com/service/itemSummary.nhn?itemcode={ticker}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://finance.naver.com/"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=18, context=CTX) as resp:
                data = json.loads(resp.read().decode("utf-8", "replace"))
            if isinstance(data, dict) and data.get("marketSum") is not None:
                return data
        except Exception:
            time.sleep(0.4 * (attempt + 1))
    return None


def num(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if value != value:
            return None
        return float(value)
    text = str(value).replace(",", "").strip()
    if not text or text in {"-", "N/A"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def main() -> None:
    quotes = json.loads(OUT.read_text(encoding="utf-8"))
    missing = [row["ticker"] for row in quotes if row.get("marketCap") in (None, 0) or row.get("per") is None]
    found: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {pool.submit(fetch_summary, t): t for t in missing}
        done = 0
        for fut in as_completed(futs):
            ticker = futs[fut]
            done += 1
            if done % 80 == 0:
                print(f"summary {done}/{len(missing)}")
            found[ticker] = fut.result() or {}
    filled = 0
    for row in quotes:
        summary = found.get(row["ticker"])
        if not summary:
            continue
        market_sum = num(summary.get("marketSum"))
        if market_sum is not None:
            row["marketCap"] = int(market_sum * 1_000_000)
            filled += 1
        row["per"] = num(summary.get("per"))
        row["pbr"] = num(summary.get("pbr"))
        row["eps"] = num(summary.get("eps"))
    OUT.write_text(json.dumps(quotes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "missing": len(missing),
        "filledMarketCap": filled,
        "withPer": sum(1 for r in quotes if r.get("per") is not None),
        "withMarketCap": sum(1 for r in quotes if r.get("marketCap")),
    }))


if __name__ == "__main__":
    main()
