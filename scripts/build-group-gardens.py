#!/usr/bin/env python3
"""Build listed-affiliate gardens from Naver group data plus 2026 KFTC supplements."""

from __future__ import annotations

import json
import re
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
QUOTES = DATA / "quotes.generated.json"
OUT = DATA / "group-gardens.generated.json"
REPORT = DATA / "group-gardens-report.json"
FTC_SNAPSHOT = DATA / "ftc-listed-affiliates.2026.json"
SEED_KRW = 10_000_000
SEED_DATE = "2026-01-02"
GROUP_SECTION = "대기업·금융그룹"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CTX = ssl.create_default_context()
NAVER_GROUPS = (
    "https://stock.naver.com/api/stockSecurity/rankings/v2/domestic/groups"
    "?sortType=changeRate&size=100&period=daily"
)
NAVER_STOCKS = (
    "https://stock.naver.com/api/domestic/market/group/{code}/stocklist"
    "?marketType=ALL&orderType=marketSum&startIdx=0&pageSize=100"
)
FTC_2026_SOURCE = "https://www.ftc.go.kr/www/selectBbsNttView.do?bordCd=3&key=12&nttSn=47410"

# KFTC 2026 groups with listed affiliates that Naver's group board does not expose,
# plus ownerless bank holding groups explicitly requested for the garden.
SUPPLEMENTS: list[tuple[str, str, list[str], str]] = [
    ("ftc_jungheung", "중흥건설", ["047040"], "KFTC 2026"),
    ("ftc_janggeum", "장금상선", ["003280"], "KFTC 2026"),
    ("ftc_hoban", "호반", ["001440"], "KFTC 2026"),
    ("ftc_nexon", "넥슨", ["225570"], "KFTC 2026"),
    ("ftc_kyobo", "교보생명보험", ["030610"], "KFTC 2026"),
    ("ftc_sono", "소노인터내셔널", ["007720", "004870"], "KFTC 2026"),
    ("ftc_kumho-petro", "금호석유화학", ["011780"], "KFTC 2026"),
    ("ftc_samchully", "삼천리", ["004690"], "KFTC 2026"),
    ("ftc_mdm", "엠디엠", ["123890"], "KFTC 2026"),
    ("ftc_daishin", "대신", ["003540"], "KFTC 2026"),
    ("ftc_joongang", "중앙", ["036420"], "KFTC 2026"),
    ("ftc_bando", "반도홀딩스", ["023960"], "KFTC 2026"),
    ("ftc_paradise", "파라다이스", ["034230"], "KFTC 2026"),
    ("ftc_hybe", "하이브", ["352820"], "KFTC 2026"),
    ("ftc_daemyung", "대명화학", ["066900", "080420", "033290", "472850"], "KFTC 2026"),
    ("ftc_sampyo", "삼표", ["038500"], "KFTC 2026"),
    ("ftc_kolmar", "한국콜마", ["200130", "024720", "161890"], "KFTC 2026"),
    ("ftc_orion", "오리온", ["086980", "271560", "001800"], "KFTC 2026"),
    ("ftc_qcp", "QCP", ["018680", "065060", "047820", "051780", "040350", "131100"], "KFTC 2026"),
    ("ftc_kai", "한국항공우주산업", ["047810"], "KFTC 2026"),
    ("ftc_hmm", "HMM", ["011200"], "KFTC 2026"),
    ("ftc_hyundai-marine", "현대해상", ["001450"], "KFTC 2026"),
    ("ftc_naver", "NAVER", ["035420"], "KFTC 2026"),
    ("ftc_s-oil", "S-Oil", ["010950"], "KFTC 2026"),
    ("ftc_hdc", "HDC", ["012630"], "KFTC 2026"),
    ("fin_kb", "KB금융", ["105560"], "financial holding"),
    ("fin_shinhan", "신한금융", ["055550", "006220"], "financial holding"),
    ("fin_hana", "하나금융", ["086790"], "financial holding"),
    ("fin_woori", "우리금융", ["316140"], "financial holding"),
    ("fin_bnk", "BNK금융", ["138930"], "financial holding"),
    ("fin_im", "iM금융", ["139130"], "financial holding"),
    ("fin_jb", "JB금융", ["175330"], "financial holding"),
    ("fin_meritz", "메리츠금융", ["138040"], "financial holding"),
    ("fin_korea-investment", "한국투자금융", ["071050"], "financial holding"),
    ("fin_ibk", "IBK금융", ["024110"], "financial group"),
]

NAME_ALIASES = {
    "에스케이": "SK",
    "엘지": "LG",
    "지에스": "GS",
    "에이치엠엠": "HMM",
    "현대해상화재보험": "현대해상",
    "에이치디씨": "HDC",
    "네이버": "NAVER",
    "에쓰-오일": "S-Oil",
    "엘엑스": "LX",
    "케이티": "KT",
    "케이티앤지": "KT&G",
    "엘에스": "LS",
    "씨제이": "CJ",
    "오씨아이": "OCI",
    "엘아이지": "LIG",
    "아이에스지주": "IS지주",
}


def canonical_group_name(name: str) -> str:
    return NAME_ALIASES.get(name, name)


def ftc_groups() -> list[dict]:
    payload = json.loads(FTC_SNAPSHOT.read_text(encoding="utf-8"))
    groups = payload.get("groups") or []
    if len(groups) != 102:
        raise ValueError(f"Expected 102 FTC groups, got {len(groups)}")
    return groups


def fetch_json(url: str):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Referer": "https://stock.naver.com/"},
    )
    with urllib.request.urlopen(request, timeout=30, context=CTX) as response:
        return json.loads(response.read().decode("utf-8", "replace"))


def quantity(price: float) -> int:
    if price <= 0:
        return 0
    return int(SEED_KRW // price)


def position(garden_id: str, ticker: str, quote: dict, plot_index: int) -> dict | None:
    seed = quote.get("yearFirstClose")
    if quote.get("yearFirstDate") != SEED_DATE or not isinstance(seed, (int, float)) or seed <= 0:
        return None
    shares = quantity(float(seed))
    if shares <= 0:
        return None
    return {
        "id": f"{garden_id}_{ticker}",
        "ticker": ticker,
        "name": quote["name"],
        "sector": GROUP_SECTION,
        "quantity": shares,
        "avgCost": seed,
        "purchasedAt": SEED_DATE,
        "plotIndex": plot_index,
    }


def garden(garden_id: str, name: str, tickers: list[str], quotes: dict[str, dict]) -> dict | None:
    plants = []
    for ticker in dict.fromkeys(tickers):
        quote = quotes.get(ticker)
        if not quote or not re.fullmatch(r"[0-9A-Z]{6}", ticker):
            continue
        plant = position(garden_id, ticker, quote, len(plants))
        if plant:
            plants.append(plant)
    if not plants:
        return None
    return {
        "id": garden_id,
        "name": name if name.endswith("그룹") else f"{name}그룹",
        "sectorName": GROUP_SECTION,
        "positions": plants,
    }


def main() -> None:
    quotes_list = json.loads(QUOTES.read_text(encoding="utf-8"))
    quotes = {row["ticker"]: row for row in quotes_list}
    group_payload = fetch_json(NAVER_GROUPS)
    gardens = []
    sources = []
    used_names = set()
    naver_members: dict[str, list[str]] = {}

    for row in sorted(group_payload.get("items", []), key=lambda item: int(item["code"])):
        code = str(row["code"])
        raw_name = str(row["name"])
        name = canonical_group_name(raw_name)
        members = fetch_json(NAVER_STOCKS.format(code=code))
        tickers = [str(item.get("itemcode", "")).upper() for item in members]
        naver_members[name] = tickers

    supplemental = {
        canonical_group_name(name): tickers
        for _, name, tickers, source in SUPPLEMENTS
        if source == "KFTC 2026"
    }
    source_groups = ftc_groups()
    for row in source_groups:
        rank = int(row["rank"])
        name = canonical_group_name(str(row["name"]))
        tickers = [
            *[str(ticker).upper() for ticker in row.get("listedTickers", [])],
            *naver_members.get(name, []),
            *supplemental.get(name, []),
        ]
        item = garden(f"grp_ftc_{rank:03d}", name, tickers, quotes)
        if item:
            gardens.append(item)
            used_names.add(name)
            sources.append({"name": name, "source": "KFTC 2026 + listed-market resolution", "rank": rank})

    for slug, name, tickers, source in SUPPLEMENTS:
        name = canonical_group_name(name)
        if source not in {"financial holding", "financial group"}:
            continue
        if name in used_names:
            continue
        item = garden(f"grp_{slug}", name, tickers, quotes)
        if item:
            gardens.append(item)
            used_names.add(name)
            sources.append({"name": name, "source": source})

    OUT.write_text(json.dumps(gardens, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    omitted_groups = [
        canonical_group_name(str(row["name"]))
        for row in source_groups
        if canonical_group_name(str(row["name"])) not in used_names
    ]
    explicit_supplements = [
        canonical_group_name(name)
        for _, name, _, source in SUPPLEMENTS
        if source in {"financial holding", "financial group"}
    ]
    REPORT.write_text(
        json.dumps(
            {
                "builtAt": datetime.now(timezone.utc).isoformat(),
                "section": GROUP_SECTION,
                "seedKrw": SEED_KRW,
                "sourceGroupCount": len(source_groups),
                "gardens": len(gardens),
                "positions": sum(len(item["positions"]) for item in gardens),
                "uniqueTickers": len({p["ticker"] for item in gardens for p in item["positions"]}),
                "omittedGroups": omitted_groups,
                "explicitSupplements": explicit_supplements,
                "sources": {
                    "naver": NAVER_GROUPS,
                    "kftc2026": FTC_2026_SOURCE,
                },
                "groups": sources,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"gardens": len(gardens), "positions": sum(len(g["positions"]) for g in gardens)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
