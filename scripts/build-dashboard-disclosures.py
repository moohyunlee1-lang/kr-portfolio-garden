"""Publish only public DART metadata from read-only local DBs. Never ship databases."""
import argparse
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORTANT = re.compile(r"투자|공급계약|실적|잠정|유상증자|무상증자|전환사채|신주인수|합병|분할|영업정지|상장폐지|시장안내|횡령|배임|자기주식|배당|소송|회생|부도|불성실|채무|최대주주")

def build(dart, sector):
    items, sources = {}, []
    for path, label, query in [
        (dart, "trading-analysis/dart_signals.db · filings", "select stock_code,title,rcept_no from filings"),
        (sector, "sector-monitor/sector_monitor.db · events", "select stock_code,report_nm,rcept_no from events"),
    ]:
        if path is None:
            continue
        with sqlite3.connect(f"file:{Path(path).resolve()}?mode=ro", uri=True) as con:
            rows = con.execute(query).fetchall()
        valid = 0
        latest = None
        for ticker, title, receipt in rows:
            if not re.fullmatch(r"[0-9A-Z]{6}", ticker or "") or not re.fullmatch(r"\d{14}", receipt or ""):
                continue
            try:
                date = datetime.strptime(receipt[:8], "%Y%m%d").date().isoformat()
            except ValueError:
                continue
            latest = max(latest or date, date)
            if not IMPORTANT.search(title or ""):
                continue
            valid += 1
            items[(ticker, receipt)] = {"ticker": ticker, "title": " ".join(title.split()), "publishedAt": date, "url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={receipt}", "source": "DART · 로컬 DB", "type": "disclosure"}
        sources.append({"name": label, "rowsExamined": len(rows), "matched": valid, "latestFilingDate": latest})
    # Retain the five latest important disclosures per ticker, including explicitly dated historical items.
    counts, selected = {}, []
    for row in sorted(items.values(), key=lambda r: (r["publishedAt"], r["url"]), reverse=True):
        ticker = row["ticker"]
        if counts.get(ticker, 0) < 5:
            selected.append(row)
            counts[ticker] = counts.get(ticker, 0) + 1
    return {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "sources": sources, "policy": "제목 키워드 기반 중요공시 · 종목별 최신 5건 · 전 시장/최근 공시 완전성 보장 안 함", "items": selected}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wiki", type=Path, default=Path.home()/"wiki")
    args = parser.parse_args()
    base = args.wiki/"10-Projects"
    result = build(base/"trading-analysis/data/dart_signals.db", base/"sector-monitor/data/sector_monitor.db")
    if not result["items"]:
        raise SystemExit("No valid public records; existing snapshot preserved")
    out = ROOT/"src/data/dashboard-disclosures.v1.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"output": str(out), "items": len(result["items"]), "sources": result["sources"]}, ensure_ascii=False))
