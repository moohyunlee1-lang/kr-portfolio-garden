import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('build_kosdaq_risk_garden.py')
spec = importlib.util.spec_from_file_location('build_kosdaq_risk_garden', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def csv_file(path, rows, fields):
    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


MEMBER_FIELDS = ['ticker', 'name', 'KIND_관리종목_지정', 'KIND_지정일', 'KIND_지정사유']
BASE_PRICE_FIELDS = ['ticker', 'observed_date', 'observed_close', 'source_url', 'verification_status']
PRICE_FIELDS = BASE_PRICE_FIELDS + ['volume', 'crosscheck_url']


class KosdaqRiskGardenTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.members = Path(self.tmp.name) / 'members.csv'
        self.prices = Path(self.tmp.name) / 'prices.csv'
        self.member_rows = [
            dict(zip(MEMBER_FIELDS, ['000123', '관리 A', '예', '2026-07-01', '시가총액 미달'])),
            dict(zip(MEMBER_FIELDS, ['009999', '비관리', '아니오', '', ''])),
        ]
        csv_file(self.members, self.member_rows, MEMBER_FIELDS)

    def price(self, ticker='000123', date='2026-09-01', close='5000',
              source='https://example.org/krx/20260901', status='independently_verified'):
        return dict(zip(PRICE_FIELDS, [ticker, date, close, source, status, '100', 'https://example.org/other-source']))

    def test_exact_membership_and_verified_observation_preserve_leading_zeros(self):
        csv_file(self.prices, [self.price(), self.price(ticker='009999')], PRICE_FIELDS)
        garden, audit = module.build(self.members, self.prices)
        self.assertEqual(garden['id'], 'kosdaq_delisting_risk')
        self.assertEqual(garden['name'], '코스닥 상폐위기')
        self.assertEqual(garden['positions'], [{
            'id': 'kosdaq_delisting_risk_000123', 'ticker': '000123', 'name': '관리 A',
            'sector': '코스닥 상폐위기', 'quantity': 2000, 'avgCost': 5000,
            'purchasedAt': '2026-09-01', 'plotIndex': 0,
        }])
        self.assertEqual(audit['membership_count'], 1)
        self.assertEqual(audit['membership_as_of'], '2026-10-06')
        self.assertEqual(audit['planted'], 1)
        self.assertEqual(audit['designated_after_reference_day'], [])
        self.assertEqual(audit['observations']['000123']['source_url'], 'https://example.org/krx/20260901')
        self.assertEqual(audit['observations']['000123']['observed_date'], '2026-09-01')
        self.assertEqual(audit['membership']['000123']['management_reason'], '시가총액 미달')
        self.assertIn('hypothetical', audit['execution_note'])
        self.assertNotIn('009999', audit['membership'])

    def test_later_designation_is_labeled_not_retroactively_removed(self):
        self.member_rows[0]['KIND_지정일'] = '2026-09-10'
        csv_file(self.members, self.member_rows, MEMBER_FIELDS)
        csv_file(self.prices, [self.price()], PRICE_FIELDS)
        garden, audit = module.build(self.members, self.prices)
        self.assertEqual(len(garden['positions']), 1)
        self.assertEqual(audit['designated_after_reference_day'], ['000123'])

    def test_zero_volume_observation_is_not_planted_even_when_marked_verified(self):
        fields = PRICE_FIELDS
        csv_file(self.prices, [{**self.price(), 'volume': '0'}], fields)
        garden, audit = module.build(self.members, self.prices)
        self.assertEqual(garden['positions'], [])
        self.assertIn('no trade', audit['skipped']['000123'])

    def test_missing_volume_or_second_source_cannot_pass_as_verified(self):
        csv_file(self.prices, [{key: self.price()[key] for key in BASE_PRICE_FIELDS}], BASE_PRICE_FIELDS)
        garden, audit = module.build(self.members, self.prices)
        self.assertEqual(garden['positions'], [])
        self.assertIn('volume', audit['skipped']['000123'])
        csv_file(self.prices, [{key: self.price()[key] for key in BASE_PRICE_FIELDS + ['volume']}], BASE_PRICE_FIELDS + ['volume'])
        garden, audit = module.build(self.members, self.prices)
        self.assertEqual(garden['positions'], [])
        self.assertIn('crosscheck', audit['skipped']['000123'])

    def test_audit_keeps_crosscheck_and_explicit_no_trade_reason(self):
        fields = PRICE_FIELDS + ['omission_reason']
        csv_file(self.prices, [{**self.price(), 'crosscheck_url': 'https://example.org/second', 'omission_reason': ''}], fields)
        _, audit = module.build(self.members, self.prices)
        self.assertEqual(audit['observations']['000123']['crosscheck_url'], 'https://example.org/second')
        csv_file(self.prices, [{**self.price(status='no_trade', close=''), 'volume': '0', 'crosscheck_url': 'https://example.org/second', 'omission_reason': 'no 2026-09-01 trade'}], fields)
        _, audit = module.build(self.members, self.prices)
        self.assertIn('no trade', audit['skipped']['000123'])

    def test_unverified_nonpositive_wrong_day_and_missing_prices_are_skipped(self):
        self.member_rows = [dict(zip(MEMBER_FIELDS, [f'{i:06d}', str(i), '예', '', 'reason'])) for i in range(1, 6)]
        csv_file(self.members, self.member_rows, MEMBER_FIELDS)
        csv_file(self.prices, [self.price('000001', status='unverified'),
                               self.price('000002', close='0'),
                               self.price('000003', date='2026-09-02'),
                               self.price('000005', source='')], PRICE_FIELDS)
        garden, audit = module.build(self.members, self.prices)
        self.assertEqual(garden['positions'], [])
        self.assertEqual(set(audit['skipped']), {f'{i:06d}' for i in range(1, 6)})
        self.assertIn('unverified', audit['skipped']['000001'])
        self.assertIn('nonpositive', audit['skipped']['000002'])
        self.assertIn('reference', audit['skipped']['000003'])
        self.assertIn('missing', audit['skipped']['000004'])
        self.assertIn('source', audit['skipped']['000005'])

    def test_duplicate_and_conflicting_price_rows_cannot_silently_choose_one(self):
        csv_file(self.prices, [self.price(), self.price(close='7000')], PRICE_FIELDS)
        garden, audit = module.build(self.members, self.prices)
        self.assertEqual(garden['positions'], [])
        self.assertIn('duplicate', audit['skipped']['000123'])

    def test_generate_refuses_to_write_without_verified_historical_price(self):
        csv_file(self.prices, [self.price(status='unverified')], PRICE_FIELDS)
        garden_out = Path(self.tmp.name) / 'garden.json'
        audit_out = Path(self.tmp.name) / 'audit.json'
        with self.assertRaises(ValueError):
            module.generate(self.members, self.prices, garden_out, audit_out)
        self.assertFalse(garden_out.exists())
        self.assertFalse(audit_out.exists())

    def test_generate_writes_garden_and_audit_with_verified_price(self):
        csv_file(self.prices, [self.price()], PRICE_FIELDS)
        garden_out = Path(self.tmp.name) / 'garden.json'
        audit_out = Path(self.tmp.name) / 'audit.json'
        module.generate(self.members, self.prices, garden_out, audit_out)
        self.assertEqual(json.loads(garden_out.read_text(encoding='utf-8'))[0]['positions'][0]['ticker'], '000123')
        self.assertEqual(json.loads(audit_out.read_text(encoding='utf-8'))['observations']['000123']['verification_status'], 'independently_verified')


if __name__ == '__main__':
    unittest.main()
