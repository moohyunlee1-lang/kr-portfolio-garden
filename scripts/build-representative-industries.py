"""Build a separate public industry snapshot. Never writes quotes or gardens."""
from html.parser import HTMLParser
import re

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = []
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        if tag in ('td', 'th'):
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(''.join(self.cell).strip())
            self.cell = None
        if tag == 'tr' and self.row:
            self.rows.append(self.row)


def parse_kind(text):
    parser = TableParser()
    parser.feed(text)
    if not parser.rows or parser.rows[0][:5] != ['회사명', '시장구분', '종목코드', '업종', '주요제품']:
        raise ValueError('Unexpected KIND schema')
    result = []
    seen = {}
    for row in parser.rows[1:]:
        if len(row) < 5 or not re.fullmatch(r'[0-9A-Z]{6}', row[2]):
            raise ValueError('Invalid KIND row/ticker; do not normalize')
        if row[2] in seen:
            if seen[row[2]] != row[:5]:
                raise ValueError('Conflicting duplicate KIND ticker')
            continue
        seen[row[2]] = row[:5]
        result.append(dict(ticker=row[2], providerName=row[0], market=row[1],
                           rawIndustry=row[3], rawIndustryCode=None, products=row[4]))
    return result


UNKNOWN = '미분류·검토 필요'
SOURCE_URL = 'https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13'


def build_records(source, quotes, themes, rules, fetched_at):
    provider = {row['ticker']: row for row in source}
    names = {row['ticker']: row['name'] for row in quotes}
    records = {}
    normalize = lambda name: re.sub(r'\s|\(주\)|주식회사', '', name)
    for ticker in sorted(provider.keys() | names.keys()):
        if not re.fullmatch(r'[0-9A-Z]{6}', ticker):
            raise ValueError(f'Invalid source ticker: {ticker}')
        raw = provider.get(ticker)
        if raw:
            industry, status, confidence, reason = classify(raw['rawIndustry'], raw['products'], rules)
            candidate = industry
            if ticker in names and normalize(names[ticker]) != normalize(raw['providerName']):
                industry, status, confidence, reason = UNKNOWN, 'identity-review', 'unresolved', '종목코드 일치하나 앱/공급자 명칭 불일치; 사명변경·약칭 여부 검토 전 자동 확정 안 함'
        else:
            industry, status, confidence, reason = UNKNOWN, 'not-in-provider', 'unresolved', 'KIND 상장법인 목록에 정확한 코드 없음; 상장폐지·종류주·누락 여부 미확인'
            candidate = None
        records[ticker] = {
            **(raw or dict(ticker=ticker, providerName=None, market=None, rawIndustry=None, rawIndustryCode=None, products=None)),
            'name': names.get(ticker, raw['providerName'] if raw else ticker),
            'representativeIndustry': industry, 'subsector': raw['rawIndustry'] if raw else None,
            'candidateIndustry': candidate, 'themes': themes.get(ticker, []),
            'sourceUrl': SOURCE_URL, 'source': 'KRX KIND 상장법인목록',
            'fetchedAt': fetched_at, 'providerAsOf': None,
            'status': status, 'confidence': confidence, 'reason': reason,
        }
    return records


def classify(raw_industry, products, rules):
    if raw_industry in rules:
        return rules[raw_industry], 'provider-industry-mapped', 'high', 'KIND 업종명 정확 일치 (최신 사업보고서 검증 아님)'
    if raw_industry in ('기타 금융업', '회사 본부 및 경영 컨설팅 서비스업'):
        compact = re.sub(r'\s', '', products)
        if '지주' in compact:
            financial = '금융지주' in compact and '비금융지주' not in compact
            return ('금융' if financial else '복합기업·지주'), 'provider-products-mapped', 'medium', 'KIND 주요제품에 지주 명시; 자회사 업종으로 재분류하지 않음'
        return UNKNOWN, 'ambiguous-provider-industry', 'unresolved', '기타금융/회사본부는 금융·비금융지주·사업전환 구분 추가 검토 필요'
    return UNKNOWN, 'unmapped-provider-industry', 'unresolved', '원문 업종에 대한 검토된 taxonomy 규칙 없음'


if __name__ == '__main__':
    import argparse
    import hashlib
    import json
    from pathlib import Path
    from datetime import datetime
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path, help='Downloaded KIND EUC-KR HTML')
    parser.add_argument('--fetched-at', required=True, help='Actual download timestamp with offset, not classification effective date')
    args = parser.parse_args()
    if datetime.fromisoformat(args.fetched_at).tzinfo is None:
        parser.error('fetched-at requires timezone')
    root = Path(__file__).resolve().parents[1]
    data = root / 'src/data'
    raw = args.input.read_bytes()
    source = parse_kind(raw.decode('euc-kr'))
    if len(source) < 1000:
        raise ValueError('Refuse partial/empty market snapshot (<1000 corporations)')
    quotes = json.loads((data / 'quotes.generated.json').read_text())
    taxonomy_bytes = (data / 'industry-taxonomy.v1.json').read_bytes()
    taxonomy = json.loads(taxonomy_bytes)
    themes = {}
    for garden in json.loads((data / 'chain-gardens.generated.json').read_text()):
        for position in garden['positions']:
            themes.setdefault(position['ticker'], set()).add(garden['sectorName'])
    themes = {ticker: sorted(values) for ticker, values in themes.items()}
    records = build_records(source, quotes, themes, taxonomy['rules'], args.fetched_at)
    output = {
        'version': 1, 'taxonomyVersion': taxonomy['version'],
        'taxonomySha256': hashlib.sha256(taxonomy_bytes).hexdigest(),
        'sourceUrl': SOURCE_URL, 'fetchedAt': args.fetched_at, 'providerAsOf': None,
        'rawSourceSha256': hashlib.sha256(raw).hexdigest(), 'providerRows': len(source),
        'policy': taxonomy['policy'] + ' 명칭 불일치는 후보만 보존하고 미분류 처리. confidence는 공급자 분류→taxonomy 연결 신뢰도이며 최신 주력사업 검증 신뢰도가 아님. 공급자 업종코드·개별 갱신시각은 원문 미제공(null).',
        'records': records,
    }
    target = data / 'representative-industries.v1.json'
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'target': str(target), 'providerRows': len(source), 'records': len(records), 'sourceSha256': output['rawSourceSha256']}, ensure_ascii=False))
