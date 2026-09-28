#!/usr/bin/env python3
"""Attach latest monthly OHLC and 12-month high/low onto quotes.generated.json."""

from __future__ import annotations

import json
import re
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

OUT = Path("/Users/moolee/projects/kr-portfolio-garden/src/data/quotes.generated.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()
ROW = re.compile(r'\["(\d{8})",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)')


def fetch_months(ticker: str) -> list[dict]:
    today = date.today().strftime("%Y%m%d")
    start = f"{date.today().year - 1}{date.today().strftime('%m%d')}"
    url = (
        "https://fchart.stock.naver.com/siseJson.nhn"
        f"?symbol={ticker}&requestType=1&startTime={start}&endTime={today}&timeframe=month"
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://finance.naver.com/"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=18, context=CTX) as resp:
                text = resp.read().decode("utf-8", "replace")
            rows = []
            for match in ROW.finditer(text):
                rows.append(
                    {
                        "open": float(match.group(2)),
                        "high": float(match.group(3)),
                        "low": float(match.group(4)),
                        "close": float(match.group(5)),
                    }
                )
            if rows:
                return rows[-12:]
        except Exception:
            time.sleep(0.35 * (attempt + 1))
    return []


def pack(rows: list[dict]) -> dict:
    if not rows:
        return {
            "monthOpen": None,
            "monthHigh": None,
            "monthLow": None,
            "monthClose": None,
            "yearHigh": None,
            "yearLow": None,
        }
    latest = rows[-1]
    return {
        "monthOpen": latest["open"],
        "monthHigh": latest["high"],
        "monthLow": latest["low"],
        "monthClose": latest["close"],
        "yearHigh": max(row["high"] for row in rows),
        "yearLow": min(row["low"] for row in rows),
    }


def main() -> None:
    quotes = json.loads(OUT.read_text(encoding="utf-8"))
    found: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = {pool.submit(fetch_months, row["ticker"]): row["ticker"] for row in quotes}
        done = 0
        for fut in as_completed(futs):
            ticker = futs[fut]
            done += 1
            if done % 100 == 0:
                print(f"monthly {done}/{len(quotes)}")
            try:
                found[ticker] = pack(fut.result())
            except Exception:
                found[ticker] = pack([])
    filled = 0
    for row in quotes:
        extra = found.get(row["ticker"]) or pack([])
        row.update(extra)
        if extra.get("monthClose"):
            filled += 1
    OUT.write_text(json.dumps(quotes, ensure_ascii=False, indent=2), encoding="utf-8")
    highs = sum(1 for row in quotes if row.get("monthHigh") and row.get("monthHigh") >= row.get("yearHigh") or False)
    lows = sum(1 for row in quotes if row.get("monthLow") and row.get("yearLow") and row["monthLow"] <= row["yearLow"])
    print(json.dumps({"quotes": len(quotes), "withMonth": filled, "atHigh": highs, "atLow": lows}))


if __name__ == "__main__":
    main()
