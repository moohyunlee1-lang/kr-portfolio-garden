#!/usr/bin/env python3
"""Optional pykrx fallback. Prints JSON. Exit 2 if pykrx is missing."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def fail(message: str, code: int = 2) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(code)


def load_pykrx():
    try:
        from pykrx import stock  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dep
        fail(f"pykrx unavailable: {exc}")
    return stock


def ymd(days_back: int = 0) -> str:
    return (datetime.now(KST) - timedelta(days=days_back)).strftime("%Y%m%d")


def last_ohlcv(stock, ticker: str):
    for back in range(0, 8):
        day = ymd(back)
        try:
            frame = stock.get_market_ohlcv(day, day, ticker)
        except Exception:
            continue
        if frame is None or getattr(frame, "empty", True):
            continue
        row = frame.iloc[-1]
        close = float(row.get("종가") or row.get("close") or 0)
        prev = None
        try:
            prev_frame = stock.get_market_ohlcv(ymd(back + 1), ymd(back + 1), ticker)
            if prev_frame is not None and not prev_frame.empty:
                prev = float(prev_frame.iloc[-1].get("종가") or 0)
        except Exception:
            prev = None
        change = 0.0 if not prev else (close - prev) / prev * 100
        volume = float(row.get("거래량") or row.get("volume") or 0)
        if close > 0:
            return {"ticker": ticker, "lastPrice": close, "changePct": change, "volume": volume}
    return None


def index_change(stock, ticker: str) -> float | None:
    for back in range(0, 8):
        try:
            frame = stock.get_index_ohlcv(ymd(back), ymd(back), ticker)
        except Exception:
            continue
        if frame is None or getattr(frame, "empty", True):
            continue
        close = float(frame.iloc[-1].get("종가") or 0)
        try:
            prev_frame = stock.get_index_ohlcv(ymd(back + 1), ymd(back + 1), ticker)
            prev = float(prev_frame.iloc[-1].get("종가") or 0) if prev_frame is not None and not prev_frame.empty else 0
        except Exception:
            prev = 0
        if close > 0 and prev > 0:
            return (close - prev) / prev * 100
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tickers", default="")
    parser.add_argument("--indexes", action="store_true")
    args = parser.parse_args()
    stock = load_pykrx()
    if args.indexes:
        print(json.dumps({
            "kospi": index_change(stock, "1001"),
            "kosdaq": index_change(stock, "2001"),
        }))
        return
    tickers = [part.strip() for part in args.tickers.split(",") if part.strip()]
    quotes = []
    for ticker in tickers:
        row = last_ohlcv(stock, ticker)
        if row:
            quotes.append(row)
    print(json.dumps({"quotes": quotes}))


if __name__ == "__main__":
    main()
