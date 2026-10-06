import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('build_ma_garden', Path(__file__).with_name('build-ma-garden.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class MaGardenTests(unittest.TestCase):
    def test_snapshot_plants_each_signal_ticker_once_with_year_first_seed(self):
        snapshot = {'source': 'ma-monitor', 'partial': False, 'as_of': '2026-10-05',
                    'scanned': 100, 'successful': 99, 'failed': 1, 'no_data': 0,
                    'targets': [{'ticker': '005930', 'name': '삼성전자', 'signals': ['touch','riding']},
                                {'ticker': '005930', 'name': '삼성전자', 'signals': ['touch']},
                                {'ticker': '000660', 'name': 'SK하이닉스', 'signals': ['riding']}]}
        quotes = [{'ticker': '005930', 'name': '삼성전자', 'yearFirstDate': '2026-01-02',
                   'yearFirstClose': 50000},
                  {'ticker': '000660', 'name': 'SK하이닉스', 'yearFirstDate': '2026-01-03',
                   'yearFirstClose': 100000}]
        gardens, report = mod.build_garden(snapshot, quotes, '2026-01-02')
        self.assertEqual([p['ticker'] for p in gardens[0]['positions']], ['005930'])
        self.assertEqual(gardens[0]['id'], 'ma_watch')
        self.assertEqual(gardens[0]['positions'][0]['quantity'], 200)
        self.assertEqual(report['skipped'][0]['reason'], 'missing exact first-session close')

    def test_partial_snapshot_is_rejected_and_cannot_replace_existing_garden(self):
        with self.assertRaisesRegex(ValueError, 'partial'):
            mod.build_garden({'source':'ma-monitor','partial':True,'targets':[]}, [], '2026-01-02')

    def test_missing_quote_or_name_mismatch_does_not_plant(self):
        snapshot = {'source':'ma-monitor','partial':False,'as_of':'2026-10-05',
                    'scanned':2,'successful':2,'failed':0,'no_data':0,
                    'targets':[{'ticker':'005930','name':'다른회사','signals':['touch']}]}
        gardens,report=mod.build_garden(snapshot,[{'ticker':'005930','name':'삼성전자',
                'yearFirstDate':'2026-01-02','yearFirstClose':50000}], '2026-01-02')
        self.assertEqual(gardens,[])
        self.assertEqual(report['skipped'][0]['reason'],'identity mismatch')
