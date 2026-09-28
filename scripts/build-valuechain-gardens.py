#!/usr/bin/env python3
"""Build value-chain garden seeds from kr-market-brain wiki + Naver/Yahoo prices."""

from __future__ import annotations

import json
import re
import ssl
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from pathlib import Path
from urllib.parse import quote

WIKI = Path("/Users/moolee/wiki/10-Projects/kr-market-brain/wiki/sectors")
OUT = Path("/Users/moolee/projects/kr-portfolio-garden/src/data")
SEED_KRW = 10_000_000
SEED_DATE = date(2026, 1, 2)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
CTX = ssl.create_default_context()

SECTORS = [
    ("semiconductor-sobujang", "반도체"),
    ("battery-valuechain", "2차전지"),
    ("bio-valuechain", "바이오"),
    ("robot-valuechain", "로봇"),
    ("ship-valuechain", "조선"),
    ("defense-valuechain", "방산"),
    ("nuclear-valuechain", "원전"),
    ("automotive-valuechain", "자동차"),
    ("cosmetics-valuechain", "화장품"),
]

LINK_RE = re.compile(r"\[\[([^|\]]+)\|([^\]]+)\]\]\s*\((\d+)\)")
TICKER_RE = re.compile(r"^([0-9A-Za-z]{6})\s+(.+)$")


def fetch(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://finance.naver.com/"})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
        return resp.read()


def parse_index(slug: str, sector_name: str) -> dict:
    text = (WIKI / slug / "index.md").read_text(encoding="utf-8")
    chains = []
    in_chains = False
    for line in text.splitlines():
        if line.startswith("## 주밸류체인"):
            in_chains = True
            continue
        if in_chains:
            if line.startswith("## "):
                break
            match = LINK_RE.search(line)
            if match:
                path, label, count = match.groups()
                file_slug = path.split("/")[-1]
                chains.append({"slug": file_slug, "label": label.strip(), "listed": int(count)})

    header = None
    rows = []
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells and set(cells[0]) <= set("-: "):
            continue
        if header is None:
            header = cells
            continue
        if len(cells) < 2:
            continue
        rows.append(cells)

    if not header:
        raise SystemExit(f"no table in {slug}")

    def col(*names: str) -> int:
        for name in names:
            for i, h in enumerate(header):
                if name in h:
                    return i
        return -1

    name_i = col("종목")
    market_i = col("시장")
    chain_i = col("주밸류체인", "밸류체인")
    status_i = col("상태")
    if name_i < 0 or chain_i < 0:
        raise SystemExit(f"bad header {slug}: {header}")

    by_label = {c["label"]: c["slug"] for c in chains}
    members = []
    unknown = []
    for cells in rows:
        raw = cells[name_i]
        match = TICKER_RE.match(raw)
        if not match:
            unknown.append(raw)
            continue
        ticker, name = match.group(1).upper(), match.group(2).strip()
        chain_label = cells[chain_i]
        chain_slug = by_label.get(chain_label)
        if chain_slug is None:
            # ship has two 08s; allow startswith match on unique prefix
            hits = [c for c in chains if chain_label.startswith(c["label"]) or c["label"].startswith(chain_label)]
            chain_slug = hits[0]["slug"] if len(hits) == 1 else None
        members.append(
            {
                "ticker": ticker,
                "name": name,
                "market": cells[market_i] if market_i >= 0 else "",
                "status": cells[status_i] if status_i >= 0 else "",
                "chainLabel": chain_label,
                "chainSlug": chain_slug,
            }
        )

    return {
        "sectorSlug": slug,
        "sectorName": sector_name,
        "chains": chains,
        "members": members,
        "unparsedNames": unknown,
    }


def parse_naver_rows(raw: bytes) -> list[dict]:
    text = raw.decode("utf-8", "replace")
    if "날짜" not in text and "date" not in text.lower():
        text = raw.decode("euc-kr", "replace")
    # [['날짜',...],['20260102', open, high, low, close, volume, ...], ...]
    text = text.strip()
    if text.startswith("["):
        try:
            data = json.loads(text.replace("'", '"'))
        except json.JSONDecodeError:
            data = None
        if isinstance(data, list) and data:
            out = []
            for row in data[1:]:
                if not row or str(row[0]).startswith("날짜"):
                    continue
                day = str(row[0]).replace("-", "")
                if len(day) != 8 or not day.isdigit():
                    continue
                close = int(str(row[4]).replace(",", ""))
                volume = int(str(row[5]).replace(",", "") or "0")
                out.append({"date": f"{day[:4]}-{day[4:6]}-{day[6:]}", "close": close, "volume": volume})
            return out
    return []


def yahoo_symbol(ticker: str, market: str) -> str:
    m = market.upper()
    if "KOSDAQ" in m or "코스닥" in m:
        return f"{ticker}.KQ"
    if "KONEX" in m or "코넥스" in m:
        return f"{ticker}.KN"
    return f"{ticker}.KS"


def fetch_yahoo(ticker: str, market: str) -> list[dict]:
    symbol = quote(yahoo_symbol(ticker, market))
    start = int(datetime(2026, 1, 1).timestamp())
    end = int(time.time()) + 86400
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?period1={start}&period2={end}&interval=1d&events=div"
    )
    raw = fetch(url)
    payload = json.loads(raw.decode("utf-8"))
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        return []
    ts = result[0].get("timestamp") or []
    quote = ((result[0].get("indicators") or {}).get("quote") or [{}])[0]
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []
    out = []
    for i, t in enumerate(ts):
        close = closes[i] if i < len(closes) else None
        if close is None:
            continue
        day = datetime.utcfromtimestamp(t + 9 * 3600).date().isoformat()
        vol = int(volumes[i] or 0) if i < len(volumes) else 0
        out.append({"date": day, "close": int(round(close)), "volume": vol})
    return out


def fetch_naver(ticker: str) -> list[dict]:
    url = (
        "https://fchart.stock.naver.com/siseJson.nhn"
        f"?symbol={quote(ticker)}&requestType=1&startTime=20260102&endTime=20261231&timeframe=day"
    )
    return parse_naver_rows(fetch(url))


def history_for(ticker: str, market: str) -> tuple[str, list[dict], str]:
    errors = []
    try:
        rows = fetch_naver(ticker)
        if rows:
            return ticker, rows, "naver"
    except Exception as exc:  # noqa: BLE001
        errors.append(f"naver:{exc}")
    try:
        rows = fetch_yahoo(ticker, market)
        if rows:
            return ticker, rows, "yahoo"
    except Exception as exc:  # noqa: BLE001
        errors.append(f"yahoo:{exc}")
    return ticker, [], ";".join(errors) or "empty"


def seed_qty(price: int) -> int:
    if price <= 0:
        return 0
    qty = SEED_KRW // price
    return qty if qty > 0 else 1


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sectors = [parse_index(slug, name) for slug, name in SECTORS]
    unique: dict[str, dict] = {}
    for sector in sectors:
        for row in sector["members"]:
            unique.setdefault(row["ticker"], {"ticker": row["ticker"], "name": row["name"], "market": row["market"]})

    print(f"sectors={len(sectors)} unique={len(unique)}")
    prices: dict[str, dict] = {}
    failed = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        futs = {pool.submit(history_for, t, meta["market"]): t for t, meta in unique.items()}
        done = 0
        for fut in as_completed(futs):
            ticker, rows, source = fut.result()
            done += 1
            if done % 100 == 0:
                print(f"prices {done}/{len(unique)}")
            if not rows:
                failed.append({"ticker": ticker, "error": source, **unique[ticker]})
                continue
            first = next((r for r in rows if r["date"] >= SEED_DATE.isoformat()), rows[0])
            last = rows[-1]
            prev = rows[-2]["close"] if len(rows) >= 2 else last["close"]
            change = 0.0 if prev <= 0 else round((last["close"] - prev) / prev * 100, 2)
            prices[ticker] = {
                "seedDate": first["date"],
                "seedClose": first["close"],
                "lastPrice": last["close"],
                "changePct": change,
                "volume": last["volume"],
                "source": source,
            }

    quotes = []
    gardens = []
    skipped = []
    for sector in sectors:
        by_chain: dict[str, list] = {}
        chain_meta = {c["slug"]: c for c in sector["chains"]}
        for row in sector["members"]:
            slug = row["chainSlug"] or "_unknown"
            by_chain.setdefault(slug, []).append(row)
        for chain_i, chain in enumerate(sector["chains"], 1):
            plants = []
            garden_id = f"vc_{sector['sectorSlug']}_{chain_i:02d}"
            for i, row in enumerate(by_chain.get(chain["slug"], [])):
                px = prices.get(row["ticker"])
                if not px or px["seedClose"] <= 0:
                    skipped.append({**row, "sector": sector["sectorName"], "reason": "no-price"})
                    continue
                qty = seed_qty(px["seedClose"])
                quotes.append(
                    {
                        "ticker": row["ticker"],
                        "name": row["name"],
                        "sector": sector["sectorName"],
                        "lastPrice": px["lastPrice"],
                        "changePct": px["changePct"],
                        "volume": px["volume"],
                    }
                )
                plants.append(
                    {
                        "id": f"{garden_id}_{row['ticker']}",
                        "ticker": row["ticker"],
                        "name": row["name"],
                        "sector": sector["sectorName"],
                        "quantity": qty,
                        "avgCost": px["seedClose"],
                        "purchasedAt": px["seedDate"],
                        "plotIndex": len(plants),
                    }
                )
            gardens.append(
                {
                    "id": garden_id,
                    "name": f"{sector['sectorName']} · {chain['label']}",
                    "sectorSlug": sector["sectorSlug"],
                    "sectorName": sector["sectorName"],
                    "chainSlug": chain["slug"],
                    "chainLabel": chain["label"],
                    "positions": plants,
                }
            )

    # unique quotes: first wiki hit is often a 지분·간접 garden (삼성전자→바이오).
    seen = {}
    unique_quotes = []
    for q in quotes:
        if q["ticker"] in seen:
            continue
        seen[q["ticker"]] = True
        unique_quotes.append(q)

    from collections import defaultdict

    by_garden: dict[str, list[str]] = defaultdict(list)
    for garden in gardens:
        for plant in garden["positions"]:
            by_garden[plant["ticker"]].append(garden["name"])
    HOME = {
        "005930": "반도체",
        "005935": "반도체",
        "000660": "반도체",
        "006400": "2차전지",
        "051910": "2차전지",
        "373220": "2차전지",
        "096770": "2차전지",
        "207940": "바이오",
        "068270": "바이오",
        "326030": "바이오",
        "005380": "자동차",
        "000270": "자동차",
        "012330": "자동차",
        "009540": "조선",
        "010140": "조선",
        "329180": "조선",
        "267250": "조선",
        "012450": "방산",
        "047810": "방산",
        "079550": "방산",
    }
    ORDER = [name for _, name in SECTORS]
    INDIRECT = re.compile(r"지분|간접|확인보류|코넥스|KONEX")

    def pick_sector(ticker: str, fallback: str) -> str:
        if ticker in HOME:
            return HOME[ticker]
        names = by_garden.get(ticker, [])
        core = [n.split(" · ", 1)[0].strip() for n in names if not INDIRECT.search(n)]
        pool = core or [n.split(" · ", 1)[0].strip() for n in names]
        for sector in ORDER:
            if sector in pool:
                return sector
        return fallback

    for q in unique_quotes:
        q["sector"] = pick_sector(q["ticker"], q["sector"])
    canonical = {q["ticker"]: q["sector"] for q in unique_quotes}

    report = {
        "seedKrw": SEED_KRW,
        "seedDate": SEED_DATE.isoformat(),
        "sectors": [
            {
                "slug": s["sectorSlug"],
                "name": s["sectorName"],
                "chains": len(s["chains"]),
                "members": len(s["members"]),
                "unparsed": s["unparsedNames"],
            }
            for s in sectors
        ],
        "uniqueTickers": len(unique),
        "priced": len(prices),
        "failed": failed,
        "skipped": skipped,
        "gardens": len(gardens),
        "planted": sum(len(g["positions"]) for g in gardens),
    }
    OUT.joinpath("quotes.generated.json").write_text(json.dumps(unique_quotes, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT.joinpath("canonical-sectors.generated.json").write_text(
        json.dumps(canonical, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    OUT.joinpath("chain-gardens.generated.json").write_text(json.dumps(gardens, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT.joinpath("valuechain-build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("uniqueTickers", "priced", "gardens", "planted")}, ensure_ascii=False))
    print("failed", len(failed), "skipped", len(skipped))


if __name__ == "__main__":
    main()
