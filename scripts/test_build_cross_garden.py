import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('build-cross-garden.py')
spec = importlib.util.spec_from_file_location('build_cross_garden', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class CrossGardenTest(unittest.TestCase):
    def test_partial_provider_coverage_is_carried_into_garden_audit(self):
        snapshot = {'as_of':'2026-10-02', 'source':'ma-monitor-kis-20x60',
                    'status':{'complete':False, 'scanned':2, 'successful':1,
                              'failed':['000660'], 'stale':[]}, 'events':[]}
        _, _, report = module.build(snapshot, [])
        self.assertFalse(report['status']['complete'])
        self.assertEqual(report['status']['failed'], ['000660'])

    def test_missing_snapshot_preserves_existing_generated_garden(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'missing.json'
            out, marks, report = (Path(tmp) / name for name in ('garden.json', 'marks.json', 'report.json'))
            out.write_text('[{"id":"cross_watch","positions":[{"ticker":"005930"}]}]')
            marks.write_text('{"005930":"golden"}')
            with self.assertRaises(FileNotFoundError):
                module.generate(source, [], out, marks, report)
            self.assertEqual(json.loads(out.read_text())[0]['positions'][0]['ticker'], '005930')
            self.assertEqual(json.loads(marks.read_text())['005930'], 'golden')

    def test_latest_event_per_ticker_and_exact_first_session(self):
        snapshot = {'as_of': '2026-10-06', 'source': 'tracker', 'events': [
            {'ticker': '000001', 'name': 'A', 'kind': 'golden', 'crossed_on': '2026-10-05', 'age_sessions': 1},
            {'ticker': '000001', 'name': 'A', 'kind': 'dead', 'crossed_on': '2026-10-06', 'age_sessions': 0},
            {'ticker': '000002', 'name': 'B', 'kind': 'golden', 'crossed_on': '2026-10-06', 'age_sessions': 0},
            {'ticker': '000003', 'name': 'C', 'kind': 'dead', 'crossed_on': '2026-10-06', 'age_sessions': 0},
            {'ticker': '000004', 'name': 'D', 'kind': 'golden', 'crossed_on': '2026-10-06', 'age_sessions': 20},
            {'ticker': '000001', 'name': 'A', 'kind': 'golden', 'crossed_on': '2026-09-01', 'age_sessions': 30},
        ]}
        quotes = [
            {'ticker': '000001', 'yearFirstDate': '2026-01-02', 'yearFirstClose': 5000},
            {'ticker': '000002', 'yearFirstDate': '2026-01-05', 'yearFirstClose': 8000},
            {'ticker': '000003', 'yearFirstDate': '2026-01-02', 'yearFirstClose': None},
        ]
        garden, marks, report = module.build(snapshot, quotes)
        self.assertEqual(garden['id'], 'cross_watch')
        self.assertEqual(garden['name'], '크로스트리')
        self.assertEqual(garden['positions'], [{'id': 'cross_watch_000001', 'ticker': '000001', 'name': 'A', 'sector': '이동평균선', 'quantity': 2000, 'avgCost': 5000, 'purchasedAt': '2026-01-02', 'plotIndex': 0}])
        self.assertEqual(marks['000001'], 'dead')
        self.assertEqual(marks['000002'], 'golden')
        self.assertEqual(set(report['skipped']), {'000002', '000003', '000004'})
        self.assertEqual(report['skipped']['000002']['name'], 'B')
        self.assertIn('first close', report['skipped']['000002']['reason'])

    def test_planted_name_uses_quote_and_audits_source_discrepancy(self):
        snapshot = {'events': [
            {'ticker': '006490', 'name': '프리티', 'kind': 'golden', 'crossed_on': '2026-10-02', 'age_sessions': 0},
            {'ticker': '291650', 'name': '츌립앤사이언스', 'kind': 'dead', 'crossed_on': '2026-10-02', 'age_sessions': 0},
        ]}
        quotes = [
            {'ticker': '006490', 'name': '인스코비', 'yearFirstDate': '2026-01-02', 'yearFirstClose': 5000},
            {'ticker': '291650', 'name': '압타머사이언스', 'yearFirstDate': '2026-01-02', 'yearFirstClose': 8000},
        ]
        garden, marks, report = module.build(snapshot, quotes)
        self.assertEqual([(p['ticker'], p['name']) for p in garden['positions']],
                         [('006490', '인스코비'), ('291650', '압타머사이언스')])
        self.assertEqual(marks, {'006490': 'golden', '291650': 'dead'})
        self.assertEqual(report['name_mismatches'], {
            '006490': {'source_name': '프리티', 'quote_name': '인스코비'},
            '291650': {'source_name': '츌립앤사이언스', 'quote_name': '압타머사이언스'},
        })

    def test_missing_snapshot_writes_empty_baseline(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'missing.json'
            out = Path(tmp) / 'garden.json'
            marks = Path(tmp) / 'marks.json'
            report = Path(tmp) / 'report.json'
            module.generate(source, [], out, marks, report)
            self.assertEqual(json.loads(out.read_text())[0]['positions'], [])
            self.assertEqual(json.loads(marks.read_text()), {})
            self.assertFalse(json.loads(report.read_text())['snapshot_available'])

if __name__ == '__main__':
    unittest.main()
