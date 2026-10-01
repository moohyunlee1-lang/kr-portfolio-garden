#!/usr/bin/env python3
"""Attach adjusted week/month/year baselines and 12-month range data."""

from __future__ import annotations

import json
import re
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "quotes.generated.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()
ROW = re.compile(r'\["(\d{8})",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)')


def fetch_days(ticker: str) -> list[dict]:
    today = date.today()
    start = today - timedelta(days=370)
    url = (
        "https://fchart.stock.naver.com/siseJson.nhn"
        f"?symbol={ticker}&requestType=1&startTime={start:%Y%m%d}&endTime={today:%Y%m%d}&timeframe=day"
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
                        "date": f"{match.group(1)[:4]}-{match.group(1)[4:6]}-{match.group(1)[6:]}",
                        "open": float(match.group(2)),
                        "high": float(match.group(3)),
                        "low": float(match.group(4)),
                        "close": float(match.group(5)),
                    }
                )
            if rows:
                return rows
        except Exception:
            time.sleep(0.35 * (attempt + 1))
    return []


def pack(rows: list[dict], requested_day: date | None = None) -> dict:
    valid = [
        row
        for row in rows
        if row.get("date")
        and row.get("open", 0) > 0
        and row.get("high", 0) > 0
        and row.get("low", 0) > 0
        and row.get("close", 0) > 0
    ]
    if not valid:
        return {
            "monthOpen": None,
            "monthHigh": None,
            "monthLow": None,
            "monthClose": None,
            "yearHigh": None,
            "yearLow": None,
            "weekOpen": None,
            "yearOpen": None,
            "yearFirstClose": None,
            "yearFirstDate": None,
            "periodAsOf": None,
        }

    latest_available = date.fromisoformat(valid[-1]["date"])
    period_day = min(requested_day or latest_available, latest_available)
    week_start = period_day - timedelta(days=period_day.weekday())
    month_rows = [
        row for row in valid
        if date.fromisoformat(row["date"]).year == period_day.year
        and date.fromisoformat(row["date"]).month == period_day.month
    ]
    year_rows = [row for row in valid if date.fromisoformat(row["date"]).year == period_day.year]
    week_rows = [row for row in valid if week_start <= date.fromisoformat(row["date"]) <= period_day]
    range_start = period_day - timedelta(days=365)
    range_rows = [row for row in valid if range_start <= date.fromisoformat(row["date"]) <= period_day]
    latest = valid[-1]
    return {
        "monthOpen": month_rows[0]["open"] if month_rows else None,
        "monthHigh": max(row["high"] for row in month_rows) if month_rows else None,
        "monthLow": min(row["low"] for row in month_rows) if month_rows else None,
        "monthClose": latest["close"],
        "yearHigh": max(row["high"] for row in range_rows),
        "yearLow": min(row["low"] for row in range_rows),
        "weekOpen": week_rows[0]["open"] if week_rows else None,
        "yearOpen": year_rows[0]["open"] if year_rows else None,
        "yearFirstClose": year_rows[0]["close"] if year_rows else None,
        "yearFirstDate": year_rows[0]["date"] if year_rows else None,
        "periodAsOf": period_day.isoformat(),
    }


def main() -> None:
    quotes = json.loads(OUT.read_text(encoding="utf-8"))
    found: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = {pool.submit(fetch_days, row["ticker"]): row["ticker"] for row in quotes}
        done = 0
        for fut in as_completed(futs):
            ticker = futs[fut]
            done += 1
            if done % 100 == 0:
                print(f"monthly {done}/{len(quotes)}")
            try:
                found[ticker] = pack(fut.result(), date.today())
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
