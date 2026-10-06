#!/usr/bin/env python3
"""Materialize crossover events into an independently seeded garden and ticker marks."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parents[1] / 'wiki/10-Projects/kr-market-brain/source-code/data/raw/ma-monitor/crossovers/latest.json'
DATE = '2026-01-02'
BUDGET = 10_000_000


def build(snapshot, quotes):
    by_ticker = {row['ticker']: row for row in quotes}
    events = {}
    skipped = {}
    for event in snapshot.get('events', []):
        ticker = event.get('ticker')
        age = event.get('age_sessions')
        if not isinstance(ticker, str) or not isinstance(age, int) or isinstance(age, bool) or not 0 <= age <= 19 or event.get('kind') not in ('golden', 'dead'):
            if isinstance(ticker, str):
                skipped[ticker] = {'name': event.get('name', ''), 'reason': 'invalid or expired event'}
            continue
        previous = events.get(ticker)
        if previous is None or (event.get('crossed_on', ''), -age) >= (previous.get('crossed_on', ''), -previous['age_sessions']):
            events[ticker] = event
    positions = []
    name_mismatches = {}
    for ticker in events:
        skipped.pop(ticker, None)
    for ticker, event in events.items():
        quote = by_ticker.get(ticker)
        close = quote.get('yearFirstClose') if quote else None
        if not quote or quote.get('yearFirstDate') != DATE or not isinstance(close, (float, int)) or isinstance(close, bool) or not math.isfinite(close) or not 0 < close <= BUDGET:
            skipped[ticker] = {'name': event['name'], 'reason': 'missing exact 2026-01-02 positive first close'}
            continue
        quote_name = quote.get('name')
        name = quote_name if isinstance(quote_name, str) and quote_name.strip() else event['name']
        if name != event['name']:
            name_mismatches[ticker] = {'source_name': event['name'], 'quote_name': name}
        positions.append({'id': f'cross_watch_{ticker}', 'ticker': ticker, 'name': name,
                          'sector': '이동평균선', 'quantity': math.floor(BUDGET / close), 'avgCost': close,
                          'purchasedAt': DATE, 'plotIndex': len(positions)})
    return ({'id': 'cross_watch', 'name': '크로스트리', 'sectorName': '이동평균선', 'positions': positions},
            {ticker: event['kind'] for ticker, event in events.items()},
            {'snapshot_available': True, 'as_of': snapshot.get('as_of'), 'source': snapshot.get('source'),
             'status': snapshot.get('status', {}), 'planted': len(positions), 'skipped': skipped,
             'name_mismatches': name_mismatches})


def generate(source, quotes, garden_out, marks_out, report_out):
    if source.is_file():
        garden, marks, report = build(json.loads(source.read_text(encoding='utf-8')), quotes)
    else:
        if garden_out.exists() or marks_out.exists():
            raise FileNotFoundError(f'missing crossover snapshot; preserving existing garden: {source}')
        garden = {'id': 'cross_watch', 'name': '크로스트리', 'sectorName': '이동평균선', 'positions': []}
        marks = {}
        report = {'snapshot_available': False, 'source': str(source), 'planted': 0, 'skipped': {}}
    for path, value in ((garden_out, [garden]), (marks_out, marks), (report_out, report)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


if __name__ == '__main__':
    print(json.dumps(generate(SOURCE, json.loads((ROOT / 'src/data/quotes.generated.json').read_text(encoding='utf-8')),
                              ROOT / 'src/data/cross-garden.generated.json',
                              ROOT / 'src/data/cross-marks.generated.json',
                              ROOT / 'src/data/cross-garden-report.json'), ensure_ascii=False))
