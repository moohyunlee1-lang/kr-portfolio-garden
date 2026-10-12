#!/usr/bin/env python3
"""Persist deterministic offline acceptance receipts; never touches canonical inputs."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixtures',ROOT/'scripts/test_build_data_status.py')
assert spec and spec.loader
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('output',type=Path)
args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
case=module.StatusBuilderTests()
case.setUp()
try:
    case.run_build()
    original=case.output.read_bytes()
    source=case.wiki/'source-code/data/raw/ma-monitor/latest.json'
    good=source.read_text()
    receipt=[]
    cross_source=case.wiki/'source-code/data/raw/ma-monitor/crossovers/latest.json'
    industry_source=case.app/'src/data/representative-industries.v1.json'
    mutations=[
        ('timestamp-object', industry_source, lambda x: x.update(fetchedAt={})),
        ('unknown-coverage-not-fresh', cross_source, lambda x: x.update(as_of='2026-10-12',status={'complete':True,'scanned':None,'successful':None})),
        ('bool-coverage', cross_source, lambda x: x.update(status={'complete':True,'scanned':True,'successful':True})),
        ('timezone-rollback', source, lambda x: x.update(as_of='2026-10-02T00:00:00+14:00')),
        ('targets-object', source, lambda x: x.update(targets={})),
        ('cross-null-date', cross_source, lambda x: x['events'][0].update(crossed_on=None)),
        ('cross-wrong-enum', cross_source, lambda x: x['events'][0].update(kind='touch')),
    ]
    for name,path,mutate in mutations:
        case.assert_rejected_mutation(path,mutate)
        assert case.output.read_bytes()==original
        receipt.append({'fixture':name,'rejected':True,'lastGoodUnchanged':True,'audit':json.loads(case.audit.read_text().splitlines()[-1])})
    for name,payload in [('malformed','{'),('all-failed',json.dumps({'as_of':'2026-10-02','scanned':2,'successful':0,'targets':[]})),('rollback',json.dumps({'as_of':'2026-10-01','scanned':2,'successful':1,'targets':[]})),('missing',None)]:
        if payload is None: source.unlink()
        else: source.write_text(payload)
        try:
            case.run_build()
            raise AssertionError('invalid fixture was published')
        except ValueError: pass
        assert case.output.read_bytes()==original
        receipt.append({'fixture':name,'rejected':True,'lastGoodUnchanged':True,'audit':json.loads(case.audit.read_text().splitlines()[-1])})
    source.write_text(good)
    assert case.run_build()=='unchanged'
    assert case.output.read_bytes()==original
    receipt.append({'fixture':'resume-identical','outcome':'unchanged','byteStable':True})
    (args.output/'fixtures-audit.jsonl').write_bytes(case.audit.read_bytes())
    (args.output/'fixture-manifest.json').write_bytes(original)
    # Exercise real CLI exit codes against isolated output and read-only real app data.
    with tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR')) as tmp:
        isolated=Path(tmp)/'manifest.json'
        isolated.write_bytes((ROOT/'src/data/data-status.v1.json').read_bytes())
        baseline=isolated.read_bytes()
        command=[sys.executable,str(ROOT/'scripts/build-data-status.py'),'--wiki',str(Path(tmp)/'missing-wiki'),'--output',str(isolated),'--audit',str(args.output/'cli-rejected.jsonl'),'--checkpoint',str(Path(tmp)/'checkpoint.json'),'--dry-run']
        bad=subprocess.run(command,capture_output=True,text=True)
        assert bad.returncode==1 and isolated.read_bytes()==baseline
        receipt.append({'fixture':'cli-missing-wiki','exitCode':bad.returncode,'stderr':bad.stderr.strip(),'lastGoodUnchanged':True})
    # Full CLI approval/resume on isolated fixture inputs, never the real sources.
    cli_output=case.root/'cli-manifest.json'
    checkpoint=case.root/'cli-checkpoint.json'
    cli_audit=args.output/'cli-approval-audit.jsonl'
    command=[sys.executable,str(ROOT/'scripts/build-data-status.py'),'--app',str(case.app),'--wiki',str(case.wiki),'--output',str(cli_output),'--audit',str(cli_audit),'--checkpoint',str(checkpoint)]
    def cli(extra, expected):
        result=subprocess.run(command+extra,capture_output=True,text=True)
        assert result.returncode==expected, (extra,result.stderr)
        return {'exitCode':result.returncode,'stdout':result.stdout.strip(),'stderr':result.stderr.strip()}
    receipt.append({'fixture':'cli-preflight',**cli(['--dry-run'],0),'published':cli_output.exists()})
    assert not cli_output.exists()
    token=json.loads(checkpoint.read_text())['approvalSha256']
    receipt.append({'fixture':'cli-wrong-approval',**cli(['--approve','wrong'],1),'published':cli_output.exists()})
    assert not cli_output.exists()
    receipt.append({'fixture':'cli-approved-partial',**cli(['--approve',token],0)})
    lastgood=cli_output.read_bytes()
    # Upgrade valid coverage, then reject complete→partial regression.
    original_cross=cross_source.read_bytes()
    data=json.loads(original_cross); data['status']={'complete':True,'scanned':2,'successful':2}; case.put(cross_source,data)
    cli(['--dry-run'],0)
    token=json.loads(checkpoint.read_text())['approvalSha256']
    receipt.append({'fixture':'cli-approved-complete',**cli(['--approve',token],0)})
    lastgood=cli_output.read_bytes()
    cross_source.write_bytes(original_cross)
    receipt.append({'fixture':'cli-partial-regression',**cli(['--dry-run'],1),'lastGoodUnchanged':cli_output.read_bytes()==lastgood})
    assert cli_output.read_bytes()==lastgood
    case.put(cross_source,data)
    receipt.append({'fixture':'cli-resume-restored',**cli(['--approve',token],0),'byteStable':cli_output.read_bytes()==lastgood})
    assert cli_output.read_bytes()==lastgood
    source_data=json.loads(good); source_data['targets'].append(dict(source_data['targets'][0])); case.put(source,source_data)
    receipt.append({'fixture':'cli-duplicate-ticker',**cli(['--dry-run'],1),'lastGoodUnchanged':cli_output.read_bytes()==lastgood})
    assert cli_output.read_bytes()==lastgood
    source.write_text(good)
    (args.output/'cli-checkpoint.json').write_bytes(checkpoint.read_bytes())
    (args.output/'cli-approved-manifest.json').write_bytes(lastgood)
    strict=subprocess.run(['node','scripts/inspect-data-status.mjs','--strict'],cwd=ROOT,capture_output=True,text=True)
    assert strict.returncode==2
    (args.output/'freshness-report.json').write_text(strict.stdout)
    receipt.append({'fixture':'inspect-strict-current-inputs','exitCode':strict.returncode,'meaning':'not all datasets fresh; not collector failure'})
    (args.output/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(receipt,ensure_ascii=False,indent=2))
finally:
    case.doCleanups()
