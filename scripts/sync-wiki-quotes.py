#!/usr/bin/env python3
"""Add every KR-Market Brain listed ticker to quotes.generated.json (search/plant universe).

Does not change value-chain gardens. Skips names with no quote.
"""

from __future__ import annotations

import json
import re
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

WIKI_ENTITIES = Path("/Users/moolee/wiki/10-Projects/kr-market-brain/wiki/entities")
OUT = Path("/Users/moolee/projects/kr-portfolio-garden/src/data/quotes.generated.json")
CANON = Path("/Users/moolee/projects/kr-portfolio-garden/src/data/canonical-sectors.generated.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()
CODE_RE = re.compile(r"^- 단축코드:\s*([0-9A-Za-z]+)", re.M)
NAME_RE = re.compile(r"^- 종목명\(KIS\):\s*(.+)$", re.M)
MARKET_RE = re.compile(r"시장:.*\|(KOSPI|KOSDAQ)")


def wiki_listings() -> list[dict]:
    rows = []
    seen: set[str] = set()
    for path in sorted(WIKI_ENTITIES.glob("*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        code = CODE_RE.search(text)
        if not code:
            continue
        ticker = code.group(1)
        if not re.fullmatch(r"\d{6}", ticker) or ticker in seen:
            continue
        seen.add(ticker)
        name_m = NAME_RE.search(text)
        market_m = MARKET_RE.search(text)
        rows.append(
            {
                "ticker": ticker,
                "name": name_m.group(1).strip() if name_m else ticker,
                "market": market_m.group(1) if market_m else "KOSPI",
            }
        )
    return rows


def http_json(url: str, headers: dict | None = None) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
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
    if last and last > 0:
        return {"lastPrice": last, "changePct": change or 0.0, "volume": volume}
    return None


def yahoo_quote(ticker: str, market: str) -> dict | None:
    suffix = ".KQ" if market == "KOSDAQ" else ".KS"
    for symbol in (f"{ticker}{suffix}", f"{ticker}.KS", f"{ticker}.KQ"):
        data = http_json(f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d")
        meta = ((data or {}).get("chart") or {}).get("result") or []
        if not meta:
            continue
        info = meta[0].get("meta") or {}
        last = num(info.get("regularMarketPrice"))
        prev = num(info.get("chartPreviousClose")) or num(info.get("previousClose"))
        volume = num(info.get("regularMarketVolume")) or 0
        change = num(info.get("regularMarketChangePercent"))
        if last and last > 0:
            if change is None and prev and prev > 0:
                change = (last - prev) / prev * 100
            return {"lastPrice": last, "changePct": change or 0.0, "volume": volume}
    return None


def one(row: dict) -> dict | None:
    hit = naver_quote(row["ticker"]) or yahoo_quote(row["ticker"], row["market"])
    if not hit:
        time.sleep(0.05)
        hit = naver_quote(row["ticker"])
    return hit


def main() -> None:
    quotes = json.loads(OUT.read_text(encoding="utf-8"))
    have = {row["ticker"] for row in quotes}
    canonical = json.loads(CANON.read_text(encoding="utf-8")) if CANON.exists() else {}
    missing = [row for row in wiki_listings() if row["ticker"] not in have]
    print(f"wiki_listed={len(have) + len(missing)} already={len(have)} missing={len(missing)}")
    found: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {pool.submit(one, row): row for row in missing}
        done = 0
        for fut in as_completed(futs):
            row = futs[fut]
            done += 1
            if done % 80 == 0:
                print(f"live {done}/{len(missing)}")
            hit = fut.result()
            if hit:
                found[row["ticker"]] = {**row, **hit}
    added = 0
    for row in missing:
        hit = found.get(row["ticker"])
        if not hit:
            continue
        quotes.append(
            {
                "ticker": row["ticker"],
                "name": row["name"],
                "sector": canonical.get(row["ticker"]) or "기타",
                "lastPrice": hit["lastPrice"],
                "changePct": hit["changePct"],
                "volume": hit["volume"],
            }
        )
        if row["ticker"] not in canonical:
            canonical[row["ticker"]] = "기타"
        added += 1
    OUT.write_text(json.dumps(quotes, ensure_ascii=False, indent=2), encoding="utf-8")
    CANON.write_text(json.dumps(canonical, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"added": added, "failed": len(missing) - added, "total": len(quotes)}))


if __name__ == "__main__":
    main()
