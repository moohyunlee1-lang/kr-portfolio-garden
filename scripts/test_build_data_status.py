"""Offline fixtures; no market requests or source mutation."""
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('status_builder', Path(__file__).with_name('build-data-status.py'))
assert spec is not None and spec.loader is not None
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class StatusBuilderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR'))
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / 'app'
        self.wiki = self.root / 'wiki'
        self.output = self.root / 'manifest.json'
        self.audit = self.root / 'audit.jsonl'
        self.put(self.app/'src/data/quotes.generated.json', [{'ticker':'005930','name':'삼성전자','lastPrice':50000,'periodAsOf':'2026-10-12'}])
        self.put(self.app/'src/data/representative-industries.v1.json', {'records':{},'fetchedAt':'2026-10-09T19:29:47+09:00','providerAsOf':None})
        self.put(self.app/'src/data/dashboard-disclosures.v1.json', {'generatedAt':'2026-10-09T00:00:00Z','items':[]})
        self.put(self.wiki/'source-code/data/raw/ma-monitor/latest.json', {'as_of':'2026-10-02','scanned':2,'successful':1,'partial':False,'targets':[{'ticker':'005930','name':'삼성전자','signals':['touch']}]})
        self.put(self.wiki/'source-code/data/raw/ma-monitor/crossovers/latest.json', {'as_of':'2026-10-02','status':{'complete':False,'scanned':2,'successful':1},'events':[{'ticker':'005930','name':'삼성전자','kind':'golden','crossed_on':'2026-10-01','age_sessions':1}]})
    def put(self, path, value):
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(value),encoding='utf-8')
    def run_build(self):
        return m.publish(self.app,self.wiki,self.output,self.audit,'2026-10-12T09:00:00+09:00')
    def assert_rejected_mutation(self, path, mutate):
        self.run_build()
        before = self.output.read_bytes()
        original = path.read_bytes()
        value = json.loads(original)
        mutate(value)
        self.put(path, value)
        try:
            with self.assertRaises(ValueError): self.run_build()
            self.assertEqual(self.output.read_bytes(), before)
            audit = json.loads(self.audit.read_text().splitlines()[-1])
            self.assertEqual(audit['outcome'], 'rejected')
            self.assertEqual(audit['preservedSha256'], m.digest(before))
        finally:
            path.write_bytes(original)

    def cli(self, paths, mode):
        command = [sys.executable, str(Path(__file__).with_name('build-data-status.py')), '--app', str(self.app), '--wiki', str(self.wiki)]
        for key, path in paths.items():
            command.extend(['--' + key, str(path)])
        return subprocess.run(command + mode, capture_output=True, text=True)

    def tree_bytes(self):
        # Include absent/new files and directories, not only the intended output.
        return {str(p.relative_to(self.root)): p.read_bytes() if p.is_file() else None
                for p in self.root.rglob('*')}

    def test_cli_rejects_pairwise_path_collisions_without_any_write(self):
        for first, second in [('audit', 'output'), ('checkpoint', 'output'), ('checkpoint', 'audit')]:
            for alias in ('direct', 'normalized', 'symlink', 'hardlink', 'parent-symlink'):
                with self.subTest(first=first, second=second, alias=alias):
                    with tempfile.TemporaryDirectory(dir=self.root) as tmp:
                        base = Path(tmp)
                        paths = {key: base / (key + '.json') for key in ('output', 'audit', 'checkpoint')}
                        self.run_build()
                        paths['output'].write_bytes(self.output.read_bytes())
                        paths['audit'].write_bytes(b'previous audit\n')
                        paths['checkpoint'].write_bytes(b'previous checkpoint\n')
                        target = paths[second]
                        if alias == 'direct': paths[first] = target
                        elif alias == 'normalized': paths[first] = base / '..' / base.name / target.name
                        elif alias == 'parent-symlink':
                            link = base / 'parent'; link.symlink_to(base, target_is_directory=True)
                            paths[first] = link / target.name
                        else:
                            link = base / 'alias.json'
                            try:
                                if alias == 'symlink': link.symlink_to(target)
                                else: os.link(target, link)
                            except (OSError, NotImplementedError) as exc:
                                self.skipTest(str(exc))
                            paths[first] = link
                        for mode in (['--dry-run'], ['--approve', 'reviewed-token']):
                            before = self.tree_bytes()
                            result = self.cli(paths, mode)
                            self.assertEqual(self.tree_bytes(), before, result.stderr)
                            self.assertEqual(result.returncode, 1, result.stdout)
                            self.assertIn('unsafe-path-collision', result.stderr)

    def test_cli_rejects_source_destinations_without_any_write(self):
        sources = [
            ('app', 'src/data/quotes.generated.json'),
            ('app', 'src/data/chain-gardens.generated.json'),
            ('app', 'src/data/representative-industries.v1.json'),
            ('app', 'src/data/dashboard-disclosures.v1.json'),
            ('wiki', 'source-code/data/raw/ma-monitor/latest.json'),
            ('wiki', 'source-code/data/raw/ma-monitor/crossovers/latest.json'),
            ('wiki', 'source-code/data/raw/52-week-highs/dual/2026-10-02.json'),
            ('wiki', 'source-code/data/raw/52-week-highs/dual/2026-10-01.json'),
        ]
        for owner, relative in sources:
            for role in ('output', 'audit', 'checkpoint'):
                for present in (True, False):
                    with self.subTest(source=relative, role=role, present=present):
                        case = StatusBuilderTests(); case.setUp()
                        try:
                            case.put(case.app/'src/data/chain-gardens.generated.json', [])
                            for date in ('2026-10-01', '2026-10-02'):
                                case.put(case.wiki/f'source-code/data/raw/52-week-highs/dual/{date}.json',
                                         {'date':date,'collectors':{'kis':{},'open_source':{}},'comparison':{'day':{'common':[]}}})
                            case.run_build()
                            paths = {'output':case.output, 'audit':case.audit, 'checkpoint':case.root/'checkpoint.json'}
                            self.assertEqual(case.cli(paths, ['--dry-run']).returncode, 0)
                            token = json.loads(paths['checkpoint'].read_text())['approvalSha256']
                            source = getattr(case, owner)/relative
                            if not present: source.unlink()
                            paths[role] = source
                            for mode in (['--dry-run'], ['--approve', token]):
                                before = case.tree_bytes()
                                result = case.cli(paths, mode)
                                self.assertEqual(case.tree_bytes(), before, result.stderr)
                                self.assertEqual(result.returncode, 1, result.stdout)
                                self.assertIn('unsafe-path-collision', result.stderr)
                        finally:
                            case.doCleanups()

    def test_cli_rejects_source_aliases_before_creating_audit_directory(self):
        source = self.app/'src/data/quotes.generated.json'
        for role in ('output', 'audit', 'checkpoint'):
            for alias in ('symlink', 'hardlink', 'parent-symlink'):
                with self.subTest(role=role, alias=alias):
                    with tempfile.TemporaryDirectory(dir=self.root) as tmp:
                        base = Path(tmp)
                        paths = {key: base/'not-created'/(key+'.json') for key in ('output', 'audit', 'checkpoint')}
                        link = base/'alias'
                        try:
                            if alias == 'hardlink': os.link(source, link)
                            elif alias == 'symlink': link.symlink_to(source)
                            else: link.symlink_to(source.parent, target_is_directory=True)
                        except (OSError, NotImplementedError) as exc:
                            self.skipTest(str(exc))
                        paths[role] = link/source.name if alias == 'parent-symlink' else link
                        for mode in (['--dry-run'], ['--approve', 'reviewed-token']):
                            before = self.tree_bytes()
                            result = self.cli(paths, mode)
                            self.assertEqual(self.tree_bytes(), before, result.stderr)
                            self.assertEqual(result.returncode, 1, result.stdout)
                            self.assertIn('unsafe-path-collision', result.stderr)

    def test_cli_rejects_missing_pairwise_aliases_without_creating_files(self):
        for first, second in [('audit', 'output'), ('checkpoint', 'output'), ('checkpoint', 'audit')]:
            with self.subTest(first=first, second=second):
                with tempfile.TemporaryDirectory(dir=self.root) as tmp:
                    base = Path(tmp)
                    link = base/'parent'
                    try:
                        link.symlink_to(base, target_is_directory=True)
                    except (OSError, NotImplementedError) as exc:
                        self.skipTest(str(exc))
                    paths = {key: base/'missing'/(key+'.json') for key in ('output', 'audit', 'checkpoint')}
                    paths[first] = link/'missing'/paths[second].name
                    for mode in (['--dry-run'], ['--approve', 'reviewed-token']):
                        before = self.tree_bytes()
                        result = self.cli(paths, mode)
                        self.assertEqual(self.tree_bytes(), before, result.stderr)
                        self.assertEqual(result.returncode, 1, result.stdout)
                        self.assertIn('unsafe-path-collision', result.stderr)

    def test_cli_distinct_paths_preflight_approval_and_retry(self):
        paths = {'output':self.app/'src/data/data-status.v1.json',
                 'audit':self.audit, 'checkpoint':self.root/'plans/checkpoint.json'}
        sources = self.tree_bytes()
        result = self.cli(paths, ['--dry-run'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(paths['output'].exists())
        token = json.loads(paths['checkpoint'].read_text())['approvalSha256']
        result = self.cli(paths, ['--approve', token])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), 'published')
        before = paths['output'].read_bytes()
        result = self.cli(paths, ['--approve', token])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), 'unchanged')
        self.assertEqual(paths['output'].read_bytes(), before)
        for name, value in sources.items():
            if value is not None: self.assertEqual((self.root/name).read_bytes(), value)

    def test_checkpoint_tamper_or_last_good_tamper_never_publishes(self):
        now = '2026-10-12T09:00:00+09:00'
        cp = self.root/'checkpoint.json'
        self.run_build()
        m.publish(self.app,self.wiki,self.output,self.audit,now,checkpoint=cp,dry_run=True)
        plan = json.loads(cp.read_text()); token=plan['approvalSha256']; original_cp=cp.read_bytes()
        plan['candidate']['entities']['005930']['name']='tampered'; self.put(cp, plan)
        before=self.output.read_bytes()
        with self.assertRaises(ValueError): m.publish(self.app,self.wiki,self.output,self.audit,now,checkpoint=cp,approval=token)
        self.assertEqual(self.output.read_bytes(),before)
        cp.write_bytes(original_cp)
        previous=json.loads(before); previous['entities']['005930']['name']='unexpected external edit'; self.put(self.output,previous)
        edited=self.output.read_bytes()
        with self.assertRaises(ValueError): m.publish(self.app,self.wiki,self.output,self.audit,now,checkpoint=cp,approval=token)
        self.assertEqual(self.output.read_bytes(),edited)

    def test_membership_edges_preserve_exact_public_record_pointer(self):
        self.put(self.app/'src/data/chain-gardens.generated.json', [{'id':'vc_test_01','name':'시험 · 소재','positions':[{'ticker':'005930','name':'삼성전자','quantity':999}]}])
        self.run_build()
        manifest = json.loads(self.output.read_text())
        edge = manifest['entities']['005930']['memberships'][0]
        self.assertEqual(edge, {'gardenId':'vc_test_01','label':'시험 · 소재','recordPointer':'/0/positions/0'})
        self.assertEqual(next(d for d in manifest['datasets'] if d['id']=='memberships')['count'],1)
        self.assertNotIn('quantity', edge)

    def test_preflight_checkpoint_approval_and_resume(self):
        cp = self.root/'checkpoint.json'
        now = '2026-10-12T09:00:00+09:00'
        self.assertEqual(m.publish(self.app,self.wiki,self.output,self.audit,now, checkpoint=cp, dry_run=True), 'awaiting-approval')
        self.assertFalse(self.output.exists())
        plan = json.loads(cp.read_text())
        self.assertIn('diff', plan)
        with self.assertRaises(ValueError):
            m.publish(self.app,self.wiki,self.output,self.audit,now,checkpoint=cp,approval='wrong')
        self.assertFalse(self.output.exists())
        self.assertEqual(m.publish(self.app,self.wiki,self.output,self.audit,now,checkpoint=cp,approval=plan['approvalSha256']), 'published')
        before = self.output.read_bytes()
        self.assertEqual(m.publish(self.app,self.wiki,self.output,self.audit,now,checkpoint=cp,approval=plan['approvalSha256']), 'unchanged')
        self.assertEqual(before, self.output.read_bytes())
        path = self.app/'src/data/quotes.generated.json'
        data = json.loads(path.read_text()); data[0]['lastPrice'] = 50001; self.put(path,data)
        with self.assertRaises(ValueError):
            m.publish(self.app,self.wiki,self.output,self.audit,now,checkpoint=cp,approval=plan['approvalSha256'])
        self.assertEqual(before, self.output.read_bytes())
        self.assertEqual(json.loads(self.audit.read_text().splitlines()[-1])['reason'], 'checkpoint-input-changed')

    def test_duplicate_quote_or_signal_tickers_are_rejected(self):
        for path, key in [(self.app/'src/data/quotes.generated.json', None), (self.wiki/'source-code/data/raw/ma-monitor/latest.json', 'targets'), (self.wiki/'source-code/data/raw/ma-monitor/crossovers/latest.json', 'events')]:
            def duplicate(value):
                rows = value if key is None else value[key]
                rows.append(dict(rows[0]))
            self.assert_rejected_mutation(path, duplicate)

    def test_complete_to_partial_or_coverage_loss_is_rejected(self):
        path = self.wiki/'source-code/data/raw/ma-monitor/crossovers/latest.json'
        data = json.loads(path.read_text())
        data['status'] = {'complete': True, 'scanned': 2, 'successful': 2}
        self.put(path, data)
        self.assert_rejected_mutation(path, lambda x: x['status'].update(complete=False, successful=1))

    def test_timestamp_types_and_required_dates(self):
        paths = [
            (self.app/'src/data/representative-industries.v1.json', 'fetchedAt'),
            (self.app/'src/data/dashboard-disclosures.v1.json', 'generatedAt'),
            (self.wiki/'source-code/data/raw/ma-monitor/latest.json', 'as_of'),
            (self.wiki/'source-code/data/raw/ma-monitor/crossovers/latest.json', 'as_of'),
        ]
        for path, field in paths:
            for bad in [{}, [], False, 0, '', None, '2026-02-30', '2026-10-01T00:00:00']:
                with self.subTest(path=path.name, field=field, bad=bad):
                    self.assert_rejected_mutation(path, lambda x: x.update({field: bad}))
        manifest = m.build(self.app, self.wiki, '2026-10-12T09:00:00+09:00')
        for bad in [{}, [], False, 0, '']:
            with self.subTest(public=bad):
                manifest['datasets'][0]['sourceAsOf'] = bad
                with self.assertRaises(ValueError): m.validate(manifest)

    def test_required_exact_integer_coverage(self):
        for dataset in ('ma', 'cross'):
            path = self.wiki/('source-code/data/raw/ma-monitor/' + ('latest.json' if dataset == 'ma' else 'crossovers/latest.json'))
            for field in ('scanned', 'successful'):
                for bad in (None, True, False, 0, -1, 1.0, '1', 'MISSING'):
                    with self.subTest(dataset=dataset, field=field, bad=bad):
                        def mutate(x):
                            s = x if dataset == 'ma' else x['status']
                            if bad == 'MISSING': s.pop(field)
                            else: s[field] = bad
                        self.assert_rejected_mutation(path, mutate)
        path = self.wiki/'source-code/data/raw/ma-monitor/crossovers/latest.json'
        self.assert_rejected_mutation(path, lambda x: x.update(as_of='2026-10-12', status={'complete':True,'scanned':None,'successful':None}))
        for bad in (None, 1, 'true'):
            self.assert_rejected_mutation(path, lambda x: x['status'].update(complete=bad))
        path = self.wiki/'source-code/data/raw/ma-monitor/latest.json'
        for bad in (None, 0, 'false', {}):
            self.assert_rejected_mutation(path, lambda x: x.update(partial=bad))
        manifest = m.build(self.app, self.wiki, '2026-10-12T09:00:00+09:00')
        row = next(x for x in manifest['datasets'] if x['id'] == 'cross')
        for counts in ((None,None), (True,True)):
            row.update(scanned=counts[0], successful=counts[1], complete=True)
            with self.assertRaises(ValueError): m.validate(manifest)

    def test_rollback_compares_instants_not_strings(self):
        path = self.wiki/'source-code/data/raw/ma-monitor/latest.json'
        self.assert_rejected_mutation(path, lambda x: x.update(as_of='2026-10-02T00:00:00+14:00'))
        # Lexically earlier but the same KST midnight is not a rollback.
        data = json.loads(path.read_text())
        data['as_of'] = '2026-10-01T15:00:00Z'
        self.put(path, data)
        self.assertEqual(self.run_build(), 'published')
        data['as_of'] = '2026-10-02T00:01:00+09:00'
        self.put(path, data)
        self.assertEqual(self.run_build(), 'published')

    def test_nested_signal_schemas_are_strict(self):
        ma = self.wiki/'source-code/data/raw/ma-monitor/latest.json'
        cross = self.wiki/'source-code/data/raw/ma-monitor/crossovers/latest.json'
        for path, key in ((ma,'targets'), (cross,'events')):
            for bad in ({}, '', None, [None], [[]]):
                with self.subTest(key=key, bad=bad):
                    self.assert_rejected_mutation(path, lambda x: x.update({key:bad}))
        for bad in ({}, [], '', None, ['golden'], ['dead'], [False]):
            with self.subTest(signals=bad):
                self.assert_rejected_mutation(ma, lambda x: x['targets'][0].update(signals=bad))
        for field, bads in [('crossed_on', [None, {}, [], '', False, '2026-02-30', '2026-10-03', '2026-9-01', '2026-10-01T00:00:00Z']), ('kind', ['touch','riding',None,{}])]:
            for bad in bads:
                with self.subTest(field=field, bad=bad):
                    self.assert_rejected_mutation(cross, lambda x: x['events'][0].update({field:bad}))
        manifest = m.build(self.app, self.wiki, '2026-10-12T09:00:00+09:00')
        signal = manifest['entities']['005930']['signals'][1]
        for field, bad in [('eventDate',None), ('kind','touch'), ('sourceAsOf',{}), ('dataset','other')]:
            original = signal[field]
            signal[field] = bad
            with self.subTest(public=field):
                with self.assertRaises(ValueError): m.validate(manifest)
            signal[field] = original
        for field in ('signals','disclosures'):
            original = manifest['entities']['005930'][field]
            manifest['entities']['005930'][field] = {}
            with self.assertRaises(ValueError): m.validate(manifest)
            manifest['entities']['005930'][field] = original

    def test_real_adapter_separates_dates_and_preserves_partial(self):
        self.assertEqual(self.run_build(),'published')
        d=json.loads(self.output.read_text())
        ds={x['id']:x for x in d['datasets']}
        self.assertIsNone(ds['quotes']['sourceAsOf'])
        self.assertIsNone(ds['industry']['sourceAsOf'])
        self.assertEqual(ds['industry']['capturedAt'],'2026-10-09T19:29:47+09:00')
        self.assertFalse(ds['ma']['complete'])
        self.assertFalse(ds['cross']['complete'])
        self.assertFalse(ds['high52-dual']['available'])
        self.assertEqual(d['entities']['005930']['signals'][0]['kind'],'touch')
        self.assertNotIn(str(self.root),self.output.read_text())

    def test_retry_is_byte_stable_and_audited(self):
        self.run_build()
        before=self.output.read_bytes()
        self.assertEqual(self.run_build(),'unchanged')
        self.assertEqual(self.output.read_bytes(),before)
        self.assertEqual([json.loads(x)['outcome'] for x in self.audit.read_text().splitlines()],['published','unchanged'])

    def test_bad_input_preserves_last_good_and_resume(self):
        self.run_build()
        before=self.output.read_bytes()
        path=self.wiki/'source-code/data/raw/ma-monitor/latest.json'
        original=path.read_text()
        cases=['{', json.dumps({'as_of':'2026-10-02','scanned':2,'successful':0,'targets':[]}), json.dumps({'as_of':'2026-10-01','scanned':2,'successful':1,'targets':[]}), json.dumps({'as_of':'2026-02-30','scanned':2,'successful':1,'targets':[]})]
        for payload in cases:
            path.write_text(payload)
            with self.assertRaises(ValueError): self.run_build()
            self.assertEqual(self.output.read_bytes(),before)
            self.assertEqual(json.loads(self.audit.read_text().splitlines()[-1])['outcome'],'rejected')
        path.unlink()
        with self.assertRaises(ValueError): self.run_build()
        self.assertEqual(self.output.read_bytes(),before)
        path.write_text(original)
        self.assertEqual(self.run_build(),'unchanged')

    def test_undated_dual_latest_is_not_a_dated_collector_output(self):
        self.put(self.wiki/'source-code/data/raw/52-week-highs/dual/latest.json', {'date':'2026-10-02','collectors':{'kis':{},'open_source':{}},'comparison':{'day':{'common':['005930']}}})
        self.run_build()
        row=next(d for d in json.loads(self.output.read_text())['datasets'] if d['id']=='high52-dual')
        self.assertFalse(row['available'])

    def test_discovers_dated_dual_not_a_fabricated_latest_path(self):
        path=self.wiki/'source-code/data/raw/52-week-highs/dual/2026-10-02.json'
        self.put(path,{'date':'2026-10-02','universe':['005930'],'collectors':{'kis':{},'open_source':{}},'comparison':{'day':{'common':['005930']}}})
        self.run_build()
        h=next(x for x in json.loads(self.output.read_text())['datasets'] if x['id']=='high52-dual')
        self.assertTrue(h['available'])
        self.assertEqual(h['sourceAsOf'],'2026-10-02')
        self.assertEqual(h['count'],1)
        self.assertIsNone(h['complete'])

    def test_invalid_shapes_coverage_and_untrusted_fields_are_not_published(self):
        self.run_build()
        before=self.output.read_bytes()
        path=self.wiki/'source-code/data/raw/ma-monitor/crossovers/latest.json'
        original=path.read_text()
        for value in [None, [], {'as_of':'2026-10-02','status':{'complete':True,'scanned':2,'successful':1},'events':[]}, {'as_of':'2026-10-13','status':{'complete':False,'scanned':2,'successful':1},'events':[]}]:
            self.put(path,value)
            with self.assertRaises(ValueError): self.run_build()
            self.assertEqual(self.output.read_bytes(),before)
        path.write_text(original)
        self.put(self.app/'src/data/dashboard-disclosures.v1.json',{'generatedAt':'2026-10-09T00:00:00Z','items':[{'ticker':'005930','publishedAt':'2026-05-22','title':'공개공시','url':'http://localhost:8888/secret','api_key':'do-not-publish','contact':'do-not-publish'}]})
        self.run_build()
        data=self.output.read_text()
        self.assertNotIn('do-not-publish',data)
        self.assertNotIn('localhost',data)
        self.assertIsNone(json.loads(data)['entities']['005930']['disclosures'][0]['url'])

    def test_audit_has_actionable_rollback_reason(self):
        self.run_build()
        self.put(self.wiki/'source-code/data/raw/ma-monitor/latest.json',{'as_of':'2026-10-01','scanned':2,'successful':1,'targets':[]})
        with self.assertRaises(ValueError): self.run_build()
        self.assertEqual(json.loads(self.audit.read_text().splitlines()[-1])['reason'],'snapshot-rollback')

    def test_malformed_public_fields_are_rejected_before_ui_publication(self):
        self.run_build()
        before=self.output.read_bytes()
        path=self.app/'src/data/representative-industries.v1.json'
        for bad in [{'records':[]},{'records':{'005930':{'name':'삼성전자','rawIndustry':{'unexpected':'object'}}}}]:
            self.put(path,bad)
            with self.assertRaises(ValueError): self.run_build()
            self.assertEqual(self.output.read_bytes(),before)
            self.assertEqual(json.loads(self.audit.read_text().splitlines()[-1])['outcome'],'rejected')

    def test_public_links_are_exact_endpoint_allowlist(self):
        safe='https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260522900658'
        self.assertEqual(m.safe_url(safe),safe)
        for url in ['http://localhost:3000/foo','file:///Users/a','javascript:alert(1)','https://dart.fss.or.kr.evil.test/dsaf001/main.do?rcpNo=20260522900658','https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260522900658&token=secret','https://user:pass@dart.fss.or.kr/dsaf001/main.do?rcpNo=20260522900658','https://dart.fss.or.kr/../../secret']:
            self.assertIsNone(m.safe_url(url))

if __name__ == '__main__': unittest.main()
