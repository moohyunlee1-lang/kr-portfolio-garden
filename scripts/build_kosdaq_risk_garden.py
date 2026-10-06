#!/usr/bin/env python3
"""Build 코스닥 상폐위기 from explicit KIND membership and independently checked closes.

Price CSV headers: ticker,observed_date,observed_close,source_url,verification_status,volume,crosscheck_url.
Each eligible row must identify the actual traded 2026-09-01 close, positive volume,
a direct public source URL, a second-source URL, and verification_status
'independently_verified'. This flag is an input assertion, NOT independent
verification performed by this script. Never substitute current/nearby prices.
Membership CSV headers: ticker,name,KIND_관리종목_지정,KIND_지정일,KIND_지정사유.
Only literal '예' members qualify; the snapshot is a source-derived candidate
list, not proof of a historical price or confirmed official market cap.
"""
import argparse
import csv
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATE = '2026-09-01'
BUDGET = 10_000_000
MEMBER_FIELDS = ('ticker', 'name', 'KIND_관리종목_지정', 'KIND_지정일', 'KIND_지정사유')
PRICE_FIELDS = ('ticker', 'observed_date', 'observed_close', 'source_url', 'verification_status')


def read_csv(path, fields):
    with Path(path).open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        missing = set(fields) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f'{path}: missing columns: {sorted(missing)}')
        return list(reader)


def build(members_csv, prices_csv):
    members = read_csv(members_csv, MEMBER_FIELDS)
    prices = read_csv(prices_csv, PRICE_FIELDS)
    eligible = {}
    for row in members:
        if row['KIND_관리종목_지정'] != '예':
            continue
        ticker = row['ticker']
        if not ticker or ticker in eligible:
            raise ValueError(f'duplicate or blank management ticker: {ticker!r}')
        eligible[ticker] = row
    by_ticker = {}
    for row in prices:
        by_ticker.setdefault(row['ticker'], []).append(row)
    garden = {'id': 'kosdaq_delisting_risk', 'name': '코스닥 상폐위기',
              'sectorName': '코스닥 상폐위기', 'positions': []}
    audit = {'reference_date': DATE, 'membership_as_of': '2026-10-06', 'membership_count': len(eligible), 'planted': 0,
             'designated_after_reference_day': [ticker for ticker, row in eligible.items()
                                                if row['KIND_지정일'] > DATE],
             'membership': {ticker: {'name': row['name'],
                                     'management_date': row['KIND_지정일'],
                                     'management_reason': row['KIND_지정사유']}
                            for ticker, row in eligible.items()},
             'observations': {}, 'skipped': {},
             'verification_note': 'Price provenance and verification status are supplied by the input CSV; this builder does not independently validate external historical bars.',
             'execution_note': 'Positions are hypothetical budget-based simulations; no historical trades or executions are asserted.'}
    for ticker, member in eligible.items():
        entries = by_ticker.get(ticker, [])
        reason = None
        if not entries:
            reason = 'missing price'
        elif len(entries) != 1:
            reason = 'duplicate price rows'
        else:
            entry = entries[0]
            if entry['observed_date'] != DATE:
                reason = 'not reference-day price'
            elif entry['verification_status'] == 'no_trade':
                reason = 'no trade on reference day'
            elif entry.get('volume') is None:
                reason = 'missing observed volume'
            elif not entry['volume'].isdigit() or int(entry['volume']) <= 0:
                reason = 'no trade on reference day (invalid or zero volume)'
            elif not entry.get('crosscheck_url', '').startswith(('https://', 'http://')):
                reason = 'missing crosscheck source URL'
            elif entry['verification_status'] != 'independently_verified':
                reason = 'unverified price'
            elif not entry['source_url'].startswith(('https://', 'http://')):
                reason = 'missing documented source URL'
            else:
                try:
                    close = Decimal(entry['observed_close'])
                except (InvalidOperation, ValueError):
                    reason = 'invalid price'
                else:
                    if not close.is_finite() or close <= 0:
                        reason = 'nonpositive or nonfinite price'
                    elif close > BUDGET:
                        reason = 'price exceeds per-position budget'
        if reason:
            audit['skipped'][ticker] = reason
            continue
        quantity = int(Decimal(BUDGET) // close)
        price = int(close) if close == close.to_integral_value() else float(close)
        garden['positions'].append({'id': f'kosdaq_delisting_risk_{ticker}',
                                    'ticker': ticker, 'name': member['name'],
                                    'sector': '코스닥 상폐위기', 'quantity': quantity,
                                    'avgCost': price, 'purchasedAt': DATE,
                                    'plotIndex': len(garden['positions'])})
        audit['observations'][ticker] = {key: entry[key] for key in PRICE_FIELDS if key != 'ticker'}
        for key in ('volume', 'crosscheck_url'):
            if key in entry:
                audit['observations'][ticker][key] = entry[key]
    audit['planted'] = len(garden['positions'])
    return garden, audit


def generate(members_csv, prices_csv, garden_out, audit_out):
    garden, audit = build(members_csv, prices_csv)
    if not garden['positions']:
        raise ValueError('no independently verified historical prices; refusing to write generated garden')
    garden_out, audit_out = Path(garden_out), Path(audit_out)
    if garden_out == audit_out:
        raise ValueError('garden and audit output paths must differ')
    for path, value in ((garden_out, [garden]), (audit_out, audit)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--members', required=True, type=Path, help='explicit local KIND membership CSV path')
    parser.add_argument('--prices', required=True, type=Path, help='historical observed closes CSV path')
    parser.add_argument('--garden-out', type=Path, default=ROOT / 'src/data/kosdaq-risk-garden.generated.json')
    parser.add_argument('--audit-out', type=Path, default=ROOT / 'src/data/kosdaq-risk-garden-report.json')
    args = parser.parse_args()
    print(json.dumps(generate(args.members, args.prices, args.garden_out, args.audit_out), ensure_ascii=False))


if __name__ == '__main__':
    main()
