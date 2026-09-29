#!/usr/bin/env python3
"""Seed convertible-bond issuance gardens from corp_sales.db.

KOSPI and KONEX are one garden each. KOSDAQ is three equal-count bands
ranked by structured face amount (unknown amount sinks to the lowest band).
Quantity is floor(10_000_000 / first 2026 session close). Names with no
2026 bar use the last traded close (not an invented price) and that
session as the seed date. Names with no quote at all are omitted.
"""

from __future__ import annotations

import json
import sqlite3
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

DB = "file:/Users/moolee/wiki-runtime/databases/10-Projects/corp-sales/data/corp_sales.db?mode=ro"
OUT = Path("/Users/moolee/projects/kr-portfolio-garden/src/data")
SEED_KRW = 10_000_000
SEED_DATE = "2026-01-02"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()
WORKERS = 4


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://finance.naver.com/"})
    with urllib.request.urlopen(req, timeout=20, context=CTX) as resp:
        return resp.read()


def parse_naver_rows(raw: bytes) -> list[dict]:
    text = raw.decode("utf-8", "replace").strip()
    if not text.startswith("["):
        text = raw.decode("euc-kr", "replace").strip()
    try:
        data = json.loads(text.replace("'", '"'))
    except json.JSONDecodeError:
        return []
    out = []
    for row in data[1:]:
        if not row:
            continue
        day = str(row[0]).replace("-", "")
        if len(day) != 8 or not day.isdigit():
            continue
        close = int(str(row[4]).replace(",", "") or "0")
        volume = int(str(row[5]).replace(",", "") or "0")
        if close <= 0:
            continue
        out.append({"date": f"{day[:4]}-{day[4:6]}-{day[6:]}", "close": close, "volume": volume})
    return out


def fetch_naver(ticker: str) -> list[dict]:
    for start in ("20260102", "20190101"):
        url = (
            "https://fchart.stock.naver.com/siseJson.nhn"
            f"?symbol={quote(ticker)}&requestType=1&startTime={start}&endTime=20261231&timeframe=day"
        )
        rows = parse_naver_rows(fetch(url))
        if rows:
            return rows
    return []


def yahoo_symbol(ticker: str, market: str) -> str:
    if market == "KOSDAQ":
        return f"{ticker}.KQ"
    if market == "KONEX":
        return f"{ticker}.KN"
    return f"{ticker}.KS"


def fetch_yahoo(ticker: str, market: str) -> list[dict]:
    symbol = quote(yahoo_symbol(ticker, market))
    start = int(datetime(2026, 1, 1).timestamp())
    end = int(time.time()) + 86400
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?period1={start}&period2={end}&interval=1d"
    )
    payload = json.loads(fetch(url).decode("utf-8"))
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        return []
    ts = result[0].get("timestamp") or []
    quote_row = ((result[0].get("indicators") or {}).get("quote") or [{}])[0]
    closes = quote_row.get("close") or []
    volumes = quote_row.get("volume") or []
    out = []
    for i, stamp in enumerate(ts):
        close = closes[i] if i < len(closes) else None
        if close is None:
            continue
        day = datetime.utcfromtimestamp(stamp + 9 * 3600).date().isoformat()
        vol = int(volumes[i] or 0) if i < len(volumes) else 0
        out.append({"date": day, "close": int(round(close)), "volume": vol})
    return out


def history_for(row: dict) -> tuple[str, list[dict], str]:
    ticker = row["stock_code"]
    try:
        rows = fetch_naver(ticker)
        if rows:
            return ticker, rows, "naver"
    except Exception as exc:  # noqa: BLE001
        naver_err = f"naver:{exc}"
    else:
        naver_err = "naver:empty"
    try:
        rows = fetch_yahoo(ticker, row["market_type"])
        if rows:
            return ticker, rows, "yahoo"
    except Exception as exc:  # noqa: BLE001
        return ticker, [], f"{naver_err};yahoo:{exc}"
    return ticker, [], naver_err


def load_stocks() -> list[dict]:
    con = sqlite3.connect(DB, uri=True)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        """
        SELECT stock_code, corp_name, market_type,
               SUM(CASE WHEN source='opendart.cvbdIsDecsn' AND face_amount_krw IS NOT NULL
                        THEN face_amount_krw ELSE 0 END) AS face_krw,
               COUNT(*) AS filings,
               MAX(rcept_dt) AS last_rcept
        FROM cb_issuance
        WHERE stock_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'
        GROUP BY stock_code
        ORDER BY face_krw DESC, corp_name
        """
    ).fetchall()
    con.close()
    return [dict(row) for row in rows]


def terciles(rows: list[dict]) -> list[list[dict]]:
    ordered = sorted(rows, key=lambda row: (-float(row["face_krw"] or 0), row["corp_name"]))
    size = len(ordered) // 3
    extra = len(ordered) % 3
    bands: list[list[dict]] = []
    cursor = 0
    for index in range(3):
        count = size + (1 if index < extra else 0)
        bands.append(ordered[cursor : cursor + count])
        cursor += count
    return bands


def plant(garden_id: str, row: dict, price: dict) -> dict:
    close = int(price["seedClose"])
    qty = SEED_KRW // close
    if qty < 1:
        qty = 1
    return {
        "id": f"{garden_id}_{row['stock_code']}",
        "ticker": row["stock_code"],
        "name": row["corp_name"],
        "sector": "전환사채",
        "quantity": qty,
        "avgCost": close,
        "purchasedAt": price["seedDate"],
        "plotIndex": 0,
        "faceKrw": float(row["face_krw"] or 0),
    }


def main() -> None:
    stocks = load_stocks()
    by_market = {"KOSPI": [], "KOSDAQ": [], "KONEX": []}
    for row in stocks:
        by_market.setdefault(row["market_type"], []).append(row)
    kosdaq_bands = terciles(by_market["KOSDAQ"])
    gardens_spec = [
        ("cb_kospi", "코스피 · 전환사채", by_market["KOSPI"]),
        ("cb_kosdaq_01", "코스닥 · 발행 상위", kosdaq_bands[0]),
        ("cb_kosdaq_02", "코스닥 · 발행 중위", kosdaq_bands[1]),
        ("cb_kosdaq_03", "코스닥 · 발행 하위", kosdaq_bands[2]),
        ("cb_konex", "코넥스 · 전환사채", by_market["KONEX"]),
    ]

    prices: dict[str, dict] = {}
    failed = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = [pool.submit(history_for, row) for row in stocks]
        for fut in as_completed(futs):
            ticker, rows, source = fut.result()
            if not rows:
                failed.append({"ticker": ticker, "error": source})
                continue
            first = next((item for item in rows if item["date"] >= SEED_DATE), None)
            traded = [item for item in rows if item["close"] > 0 and item["volume"] > 0]
            tape = traded or [item for item in rows if item["close"] > 0]
            if not tape:
                failed.append({"ticker": ticker, "error": source or "empty"})
                continue
            last = tape[-1]
            seed = first if first and first["close"] > 0 else last
            prev = tape[-2]["close"] if len(tape) >= 2 else last["close"]
            change = 0.0 if prev <= 0 else round((last["close"] - prev) / prev * 100, 2)
            prices[ticker] = {
                "seedDate": seed["date"],
                "seedClose": seed["close"],
                "lastPrice": last["close"],
                "changePct": change,
                "volume": last["volume"],
                "source": source,
            }

    gardens = []
    planted = []
    skipped = []
    for garden_id, name, rows in gardens_spec:
        positions = []
        for row in rows:
            price = prices.get(row["stock_code"])
            if not price or price["seedClose"] <= 0:
                skipped.append(row)
                continue
            item = plant(garden_id, row, price)
            item["plotIndex"] = len(positions)
            positions.append(item)
            planted.append({**row, "gardenId": garden_id, "gardenName": name})
        gardens.append(
            {
                "id": garden_id,
                "name": name,
                "sectorName": "전환사채",
                "positions": [
                    {key: value for key, value in position.items() if key != "faceKrw"}
                    for position in positions
                ],
            }
        )

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "cb-gardens.generated.json").write_text(
        json.dumps(gardens, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    quotes_path = OUT / "quotes.generated.json"
    existing = json.loads(quotes_path.read_text(encoding="utf-8"))
    seen = {item["ticker"] for item in existing}
    added = 0
    for row in planted:
        ticker = row["stock_code"]
        if ticker in seen:
            continue
        price = prices[ticker]
        existing.append(
            {
                "ticker": ticker,
                "name": row["corp_name"],
                "sector": "기타",
                "lastPrice": price["lastPrice"],
                "changePct": price["changePct"],
                "volume": price["volume"],
            }
        )
        seen.add(ticker)
        added += 1
    if added:
        quotes_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = {
        "gardens": [
            {"id": garden["id"], "name": garden["name"], "plants": len(garden["positions"])}
            for garden in gardens
        ],
        "planted": len(planted),
        "skipped": [{"stock_code": row["stock_code"], "corp_name": row["corp_name"], "market_type": row["market_type"]} for row in skipped],
        "quotes_added": added,
        "failed": failed,
    }
    (OUT / "cb-gardens-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
