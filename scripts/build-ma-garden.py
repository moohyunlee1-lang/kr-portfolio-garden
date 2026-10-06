#!/usr/bin/env python3
"""Materialize the kr-market-brain MA watchlist as one generated garden."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
SEED_KRW = 10_000_000
SEED_DATE = "2026-01-02"
GARDEN_ID = "ma_watch"


def build_garden(snapshot: dict, quotes: list[dict], seed_date: str = SEED_DATE):
    if snapshot.get("source") != "ma-monitor" or snapshot.get("partial") is not False:
        raise ValueError("partial or invalid MA monitor snapshot")
    if not snapshot.get("as_of") or not isinstance(snapshot.get("targets"), list):
        raise ValueError("snapshot missing date or targets")
    if snapshot.get("successful", 0) <= 0 or snapshot.get("scanned", 0) <= 0:
        raise ValueError("snapshot lacks completed quote collection")
    by_code = {row["ticker"]: row for row in quotes}
    positions, skipped, seen = [], [], set()
    for item in snapshot["targets"]:
        ticker = item.get("ticker", "")
        name = item.get("name", "")
        if not re.fullmatch(r"[0-9A-Z]{6}", ticker) or not name or not item.get("signals"):
            raise ValueError("invalid MA target")
        if ticker in seen:
            continue
        seen.add(ticker)
        quote = by_code.get(ticker)
        reason = None
        if not quote:
            reason = "missing garden quote"
        elif quote.get("name") != name:
            reason = "identity mismatch"
        elif quote.get("yearFirstDate") != seed_date or not isinstance(quote.get("yearFirstClose"), (int, float)) or quote["yearFirstClose"] <= 0:
            reason = "missing exact first-session close"
        elif int(SEED_KRW // quote["yearFirstClose"]) == 0:
            reason = "seed price exceeds budget"
        if reason:
            skipped.append({"ticker": ticker, "reason": reason})
            continue
        positions.append({"id": f"{GARDEN_ID}_{ticker}", "ticker": ticker, "name": name,
                          "sector": "이동평균선", "quantity": int(SEED_KRW // quote["yearFirstClose"]),
                          "avgCost": quote["yearFirstClose"], "purchasedAt": seed_date,
                          "plotIndex": len(positions)})
    gardens = ([{"id": GARDEN_ID, "name": "라이딩트리", "sectorName": "이동평균선",
                 "positions": positions}] if positions else [])
    report = {"source": snapshot["source"], "as_of": snapshot["as_of"],
              "scanned": snapshot["scanned"], "targets": len(seen),
              "planted": len(positions), "skipped": skipped}
    return gardens, report


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path, help="MA monitor snapshot JSON (explicit path)")
    args = parser.parse_args(argv)
    snapshot = json.loads(args.source.read_text(encoding="utf-8"))
    quotes = json.loads((DATA / "quotes.generated.json").read_text(encoding="utf-8"))
    gardens, report = build_garden(snapshot, quotes)
    for name, payload in (("ma-garden.generated.json", gardens), ("ma-garden-report.json", report)):
        (DATA / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
