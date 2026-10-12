#!/usr/bin/env python3
"""Read-only local adapters → deliberately public provenance snapshot. Never fetches."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import tempfile
import fcntl
from datetime import datetime, timezone
from urllib.parse import urlsplit, parse_qs
from pathlib import Path
from typing import Any, Literal, overload


def safe_url(value):
    if not isinstance(value,str): return None
    try:
        u=urlsplit(value)
        if u.scheme!='https' or u.username or u.password or u.port or u.fragment: return None
        params=parse_qs(u.query)
        if u.hostname=='dart.fss.or.kr' and u.path=='/dsaf001/main.do' and re.fullmatch(r'rcpNo=\d{14}',u.query): return value
        if u.hostname=='kind.krx.co.kr' and u.path=='/corpgeneral/corpList.do' and params=={'method':['download'],'searchType':['13']} and len(u.query.split('&'))==2: return value
    except ValueError: pass
    return None


@overload
def timestamp(value, *, required: Literal[True]) -> datetime: ...

@overload
def timestamp(value, *, required: bool = False) -> datetime | None: ...

def timestamp(value, *, required=False):
    if value is None and not required:
        return None
    if not isinstance(value, str) or not value:
        raise ValueError('timestamp-type')
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        value += 'T00:00:00+09:00'
    elif not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})', value):
        raise ValueError('future-or-unzoned-date')
    stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        raise ValueError('future-or-unzoned-date')
    return stamp


def coverage(scanned, successful, complete=None, *, required=False):
    if required or scanned is not None or successful is not None:
        if type(scanned) is not int or type(successful) is not int or not 0 < successful <= scanned:
            raise ValueError('all-failed-or-invalid-coverage')
    if (required or complete is not None) and type(complete) is not bool:
        raise ValueError('complete-type')
    if complete is True and (scanned is None or successful != scanned):
        raise ValueError('complete-coverage-conflict')


def array(value):
    if not isinstance(value, list): raise ValueError('source-shape')
    return value


def obj(value):
    if not isinstance(value, dict): raise ValueError('source-shape')
    return value


def event_date(value, source_as_of):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('event-date')
    if timestamp(value, required=True) > timestamp(source_as_of, required=True):
        raise ValueError('future-event')


def signal_kind(value, dataset):
    allowed = {'ma': ('touch','riding'), 'cross': ('golden','dead')}
    if dataset not in allowed or value not in allowed[dataset]: raise ValueError('signal-kind')


def validate_source(data, key):
    # Validate consumed source fields before len/iteration/boolean derivation can
    # erase malformed empty objects or coerce unknown coverage into freshness.
    rows = data if key == 'quotes' else data.get('targets', []) if key == 'ma' else data.get('events', []) if key == 'cross' else []
    seen = set()
    for item in array(rows):
        code = obj(item).get('ticker')
        if not isinstance(code, str) or not re.fullmatch(r'[0-9A-Z]{6}', code): raise ValueError('ticker-format')
        if code in seen: raise ValueError('duplicate-ticker')
        seen.add(code)
    if key == 'industry':
        timestamp(data.get('fetchedAt'), required=True)
        timestamp(data.get('providerAsOf'))
        for record in obj(data['records']).values(): obj(record)
    elif key == 'disclosures':
        timestamp(data.get('generatedAt'), required=True)
        for item in array(data['items']):
            obj(item)
            event_date(item['publishedAt'], data['generatedAt'])
    elif key in ('ma','cross'):
        timestamp(data.get('as_of'), required=True)
        if key == 'ma':
            if type(data.get('partial', False)) is not bool: raise ValueError('complete-type')
            coverage(data.get('scanned'), data.get('successful'), False, required=True)
            for target in array(data['targets']):
                obj(target)
                signals = array(target['signals'])
                if not signals: raise ValueError('signal-kind')
                for signal in signals: signal_kind(signal, 'ma')
        else:
            status = obj(data['status'])
            coverage(status.get('scanned'), status.get('successful'), status.get('complete'), required=True)
            for event in array(data['events']):
                obj(event)
                signal_kind(event['kind'], 'cross')
                event_date(event['crossed_on'], data['as_of'])
    elif key == 'quotes':
        for item in array(data): obj(item)
    elif key == 'memberships':
        ids = set()
        for group in array(data):
            obj(group)
            if not isinstance(group.get('id'),str) or not re.fullmatch(r'vc_[a-z0-9_-]+',group['id']) or group['id'] in ids: raise ValueError('membership-shape')
            ids.add(group['id'])
            if not isinstance(group.get('name'),str): raise ValueError('public-field-type')
            validate_source(array(group['positions']), 'quotes')
    elif key == 'high52-dual':
        timestamp(data.get('date'), required=True)
        obj(data['collectors'])
        array(obj(obj(data['comparison'])['day'])['common'])


def validate(manifest, previous=None):
    if manifest['schemaVersion']!=1: raise ValueError('schema')
    now=timestamp(manifest['generatedAt'], required=True)
    old={x['id']:x for x in (previous or {}).get('datasets',[])}
    for row in manifest['datasets']:
        for field in ('sourceAsOf','capturedAt'):
            required = row['available'] and ((field == 'sourceAsOf' and row['id'] in ('ma','cross','high52-dual')) or (field == 'capturedAt' and row['id'] in ('industry','disclosures')))
            stamp=timestamp(row[field], required=required)
            if stamp is not None and stamp>now: raise ValueError('future-or-unzoned-date')
        coverage(row['scanned'], row['successful'], row['complete'], required=row['available'] and row['id'] in ('ma','cross'))
        prior=old.get(row['id'])
        if prior and prior['available']:
            if not row['available']: raise ValueError('source-disappeared')
            if prior.get('complete') is True and row['complete'] is not True: raise ValueError('coverage-regression')
            if prior.get('successful') is not None and row['successful'] is not None and (row['successful'] < prior['successful'] or row['scanned'] < prior['scanned']): raise ValueError('coverage-regression')
            if row['id'] in ('quotes', 'industry', 'disclosures', 'memberships') and row['count'] < prior['count']: raise ValueError('record-loss')
            prior_stamp = timestamp(prior['sourceAsOf'])
            current_stamp = timestamp(row['sourceAsOf'])
            if prior_stamp is not None and (current_stamp is None or current_stamp < prior_stamp): raise ValueError('snapshot-rollback')
    if not any(x['available'] and x['count'] for x in manifest['datasets']): raise ValueError('all-missing')
    for ticker,record in manifest['entities'].items():
        if not re.fullmatch(r'[0-9A-Z]{6}',ticker): raise ValueError('ticker-format')
        if not isinstance(record['name'],str): raise ValueError('public-field-type')
        if record['industry']:
            if any(value is not None and not isinstance(value,str) for value in record['industry'].values()): raise ValueError('public-field-type')
        for disclosure in array(record['disclosures']):
            obj(disclosure)
            if not isinstance(disclosure['title'],str): raise ValueError('public-field-type')
            event_date(disclosure['publishedAt'], manifest['generatedAt'])
        for signal in array(record['signals']):
            obj(signal)
            signal_kind(signal['kind'], signal['dataset'])
            stamp = timestamp(signal['sourceAsOf'], required=True)
            if stamp > now: raise ValueError('future-or-unzoned-date')
            if signal['dataset'] == 'cross':
                event_date(signal['eventDate'], signal['sourceAsOf'])
            elif signal['eventDate'] is not None:
                raise ValueError('event-date')
    return manifest

ROOT = Path(__file__).resolve().parents[1]

def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()

def build(app: Path, wiki: Path, generated_at: str) -> dict:
    datasets, entities = [], {}
    def entity(ticker, name=''):
        return entities.setdefault(ticker, {'ticker':ticker,'name':name,'signals':[],'disclosures':[], 'memberships':[], 'industry':None})
    def load(base, relative, key, label, provider) -> tuple[Any, dict]:
        path=base/relative
        exists=path.is_file()
        raw=path.read_bytes() if exists else None
        data=json.loads(raw) if raw is not None else None
        if exists and (data is None or not isinstance(data,list if key in ('quotes','memberships') else dict)): raise ValueError('source-shape')
        if data is not None: validate_source(data, key)
        row={'id':key,'label':label,'provider':provider,'available':exists,'sourceAsOf':None,'capturedAt':None,'complete':None,'count':0,'successful':None,'scanned':None,'sha256':digest(raw) if raw else None,'sourceRef':relative,'note':''}
        datasets.append(row)
        return data,row
    quotes,q=load(app,'src/data/quotes.generated.json','quotes','저장 가격','개별 제공자 미기록 (KIS→Yahoo→pykrx→Naver 경로)')
    if quotes is not None:
        q['count']=len(quotes)
        q['note']='가격 시각 미제공. periodAsOf는 기간봉 날짜이며 lastPrice의 기준일이 아닙니다. 실시간 세션 오버레이는 이 매니페스트에 포함하지 않습니다.'
        for x in quotes: entity(x['ticker'], x['name'])
    groups,g=load(app,'src/data/chain-gardens.generated.json','memberships','밸류체인 소속','기존 공개 생성 정원 · 사용자 분류')
    if groups is not None:
        g['count']=sum(len(group['positions']) for group in groups)
        g['note']='공개 정원에 심긴 분류 소속만 수록. 매수일은 분류 기준일이 아니며 기준일 미상. 소속 교집합은 공급·고객 관계가 아닙니다. JSON Pointer는 아래 SHA256 파일의 정확한 행을 가리킵니다.'
        for gi, group in enumerate(groups):
            for pi, position in enumerate(group['positions']):
                entity(position['ticker'],position['name'])['memberships'].append({'gardenId':group['id'],'label':group['name'],'recordPointer':f'/{gi}/positions/{pi}'})
    industry,i=load(app,'src/data/representative-industries.v1.json','industry','대표업종','KRX KIND 상장법인목록')
    if industry is not None:
        i.update(sourceAsOf=industry.get('providerAsOf'),capturedAt=industry.get('fetchedAt'),count=len(industry['records']))
        i['note']='수집 시각은 업종 유효일이 아닙니다. 공급자 업종→대표업종 매핑이며 최신 사업보고서 검증 아님.'
        for ticker,x in industry['records'].items():
            record={k:x.get(k) for k in ('representativeIndustry','rawIndustry','status','confidence','reason')}
            record['sourceUrl']=safe_url(x.get('sourceUrl'))
            entity(ticker,x.get('name',''))['industry']=record
    filings,f=load(app,'src/data/dashboard-disclosures.v1.json','disclosures','중요공시 스냅샷','DART · 기존 공개 추출본')
    if filings is not None:
        items=filings['items']
        f.update(sourceAsOf=max((x['publishedAt'] for x in items),default=None),capturedAt=filings.get('generatedAt'),count=len(items),complete=False)
        f['note']='선별·종목별 제한 스냅샷. 최신 날짜는 수록 공시 중 최대값이며 전 시장 갱신 완료일이 아닙니다.'
        for x in items: entity(x['ticker'])['disclosures'].append({'title':x['title'],'publishedAt':x['publishedAt'],'url':safe_url(x.get('url'))})
    ma,a=load(wiki,'source-code/data/raw/ma-monitor/latest.json','ma','MA 관찰','KIS 단일 제공자')
    if ma is not None:
        a.update(sourceAsOf=ma['as_of'],scanned=ma['scanned'],successful=ma['successful'],count=len(ma['targets']),complete=not ma.get('partial',False) and ma['successful']==ma['scanned'])
        a['note']='성공/스캔은 수집 범위, 건수는 신호 종목 수입니다. 제외·데이터 없음도 전체 유효 관측으로 취급하지 않습니다. 원봉의 공개 원문 URL은 미제공.'
        for x in ma['targets']:
            for signal in x['signals']: entity(x['ticker'],x['name'])['signals'].append({'dataset':'ma','kind':signal,'sourceAsOf':ma['as_of'],'eventDate':None})
    cross,c=load(wiki,'source-code/data/raw/ma-monitor/crossovers/latest.json','cross','20/60 크로스','KIS 단일 제공자')
    if cross is not None:
        s=cross['status']
        c.update(sourceAsOf=cross['as_of'],scanned=s['scanned'],successful=s['successful'],complete=s['complete'],count=len(cross['events']))
        c['note']='최근 20 관측 거래일 내 마지막 교차. 원천에 기록된 교차일을 보존합니다. 공시 링크는 기업 배경 자료이며 기술 신호를 검증하는 원봉이 아닙니다.'
        for x in cross['events']: entity(x['ticker'],x['name'])['signals'].append({'dataset':'cross','kind':x['kind'],'sourceAsOf':cross['as_of'],'eventDate':x['crossed_on']})
    dual_dir='source-code/data/raw/52-week-highs/dual'
    dated=sorted(p for p in (wiki/dual_dir).glob('*.json') if re.fullmatch(r'\d{4}-\d{2}-\d{2}\.json',p.name))
    relative=str(dated[-1].relative_to(wiki)) if dated else dual_dir
    dual,h=load(wiki,relative,'high52-dual','52주 고가 독립 수집','KIS + 오픈소스')
    if dual is not None:
        if set(dual['collectors'])!={'kis','open_source'}: raise ValueError('dual-collectors')
        h.update(sourceAsOf=dual['date'],count=len(dual['comparison']['day']['common']))
    h['note']='날짜별 dual 감사의 존재·공통 일봉 통과 건수만 표시. 세부 수집 범위·성공 검증은 미구현(unknown). 미발견 시 missing이며 pipeline/consensus로 대체하지 않습니다. 자동 운영 복구를 의미하지 않습니다.'
    return {'schemaVersion':1,'generatedAt':generated_at,'datasets':datasets,'entities':dict(sorted(entities.items()))}

def content_hash(manifest):
    return digest(json.dumps({k:v for k,v in manifest.items() if k not in ('generatedAt','contentSha256')},ensure_ascii=False,sort_keys=True).encode())


def atomic_write(output, encoded):
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(dir=os.environ.get('TMPDIR'), delete=False) as f:
            temp = Path(f.name)
            f.write(encoded); f.flush(); os.fsync(f.fileno())
        os.replace(temp, output)
    finally:
        if temp and temp.exists(): temp.unlink()


def validate_paths(app, wiki, output, audit, checkpoint):
    # Resolve absent leaves and symlinked parents; samefile also detects hardlinks.
    paths = [path.resolve() for path in (output, audit, checkpoint) if path is not None]
    sources = [app/'src/data'/name for name in (
        'quotes.generated.json', 'chain-gardens.generated.json',
        'representative-industries.v1.json', 'dashboard-disclosures.v1.json')]
    sources += [wiki/'source-code/data/raw/ma-monitor'/name for name in (
        'latest.json', 'crossovers/latest.json')]
    dual = (wiki/'source-code/data/raw/52-week-highs/dual').resolve()
    dated_name = r'\d{4}-\d{2}-\d{2}\.json'
    # Protect the whole dated-input namespace, including currently missing files:
    # writing a new date would change which source build() discovers next time.
    sources += [dual] + [p for p in dual.glob('*.json') if re.fullmatch(dated_name, p.name)]
    sources = [path.resolve() for path in sources]
    for index, path in enumerate(paths):
        if path.parent == dual and re.fullmatch(dated_name, path.name):
            raise ValueError('unsafe-path-collision')
        for other in paths[:index] + sources:
            if path == other or (path.exists() and other.exists() and path.samefile(other)):
                raise ValueError('unsafe-path-collision')


def publish(app: Path, wiki: Path, output: Path, audit: Path, generated_at: str, *, checkpoint=None, dry_run=False, approval=None) -> str:
    validate_paths(app, wiki, output, audit, checkpoint)
    # Serialize local publishers; lock remains attached to the audit inode.
    audit.parent.mkdir(parents=True,exist_ok=True)
    with audit.open('a',encoding='utf-8') as log:
        fcntl.flock(log,fcntl.LOCK_EX)
        previous_bytes=output.read_bytes() if output.exists() else None
        def record(outcome, **fields):
            log.write(json.dumps({'attemptedAt':generated_at,'outcome':outcome,**fields},ensure_ascii=False)+'\n')
            log.flush()
            os.fsync(log.fileno())
        try:
            previous=json.loads(previous_bytes) if previous_bytes else None
            if previous and previous.get('contentSha256') != content_hash(previous): raise ValueError('last-good-integrity')
            manifest=validate(build(app,wiki,generated_at),previous)
            fingerprint=content_hash(manifest)
            manifest['contentSha256']=fingerprint
            if checkpoint:
                if checkpoint.resolve() in (output.resolve(), audit.resolve()): raise ValueError('checkpoint-path')
                if dry_run:
                    prior = {d['id']: d for d in (previous or {}).get('datasets', [])}
                    plan = {'schemaVersion':1, 'candidate':manifest, 'baseSha256':digest(previous_bytes) if previous_bytes else None,
                            'diff':[{'id':d['id'], 'before':prior.get(d['id']), 'after':d} for d in manifest['datasets'] if d != prior.get(d['id'])]}
                    plan['approvalSha256']=digest(json.dumps(plan,ensure_ascii=False,sort_keys=True).encode())
                    atomic_write(checkpoint,(json.dumps(plan,ensure_ascii=False,indent=2)+'\n').encode())
                    record('awaiting-approval', approvalSha256=plan['approvalSha256'], preservedSha256=plan['baseSha256'])
                    return 'awaiting-approval'
                plan=json.loads(checkpoint.read_text())
                token=plan.pop('approvalSha256')
                if approval != token or digest(json.dumps(plan,ensure_ascii=False,sort_keys=True).encode()) != token: raise ValueError('approval-mismatch')
                candidate=plan['candidate']
                if content_hash(candidate) != fingerprint or candidate['contentSha256'] != fingerprint: raise ValueError('checkpoint-input-changed')
                if (digest(previous_bytes) if previous_bytes else None) != plan['baseSha256'] and (previous or {}).get('contentSha256') != fingerprint: raise ValueError('checkpoint-base-changed')
                manifest=validate(candidate, previous)
            elif dry_run or approval is not None:
                raise ValueError('checkpoint-required')
            if previous_bytes and previous and previous.get('contentSha256')==fingerprint:
                record('unchanged',contentSha256=fingerprint,manifestSha256=digest(previous_bytes))
                return 'unchanged'
            encoded=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
        except (ValueError,KeyError,TypeError,AttributeError,OSError) as exc:
            safe_reasons={'last-good-integrity','checkpoint-required','checkpoint-path','approval-mismatch','checkpoint-input-changed','checkpoint-base-changed','duplicate-ticker','coverage-regression','record-loss','membership-shape','schema','timezone','future-or-unzoned-date','all-failed-or-invalid-coverage','complete-type','complete-coverage-conflict','source-disappeared','snapshot-rollback','ticker-format','signal-kind','future-event','source-shape','dual-collectors','all-missing','public-field-type','timestamp-type','event-date'}
            reason=str(exc) if str(exc) in safe_reasons else type(exc).__name__
            record('rejected',reason=reason,preservedSha256=digest(previous_bytes) if previous_bytes else None)
            raise ValueError('input-validation-rejected; last good preserved') from exc
        atomic_write(output, encoded)
        record('published',contentSha256=fingerprint,manifestSha256=digest(encoded))
        return 'published'

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--wiki',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=ROOT/'src/data/data-status.v1.json')
    parser.add_argument('--audit',type=Path,required=True)
    parser.add_argument('--app',type=Path,default=ROOT,help='Isolated fixtures or canonical read-only snapshot inputs')
    parser.add_argument('--checkpoint',type=Path,required=True)
    mode=parser.add_mutually_exclusive_group()
    mode.add_argument('--dry-run',action='store_true',help='Default: validate/diff/checkpoint only; no publication')
    mode.add_argument('--approve',metavar='SHA256',help='Resume checkpoint after review; bind exact inputs and last-good hash')
    args=parser.parse_args()
    from datetime import datetime, timezone
    try:
        print(publish(args.app,args.wiki,args.output,args.audit,datetime.now(timezone.utc).isoformat(), checkpoint=args.checkpoint, dry_run=args.approve is None, approval=args.approve))
    except ValueError as exc:
        if str(exc) == 'unsafe-path-collision':
            parser.exit(1,'rejected: unsafe-path-collision; no files written or audit opened\n')
        parser.exit(1,'rejected: input validation failed; last good preserved; inspect local audit\n')
