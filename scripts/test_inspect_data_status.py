"""Exercise the actual offline report CLI, not a second freshness implementation."""
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]

class InspectStatusTests(unittest.TestCase):
    def test_markdown_report_is_linkable_and_explicit_about_market_reference(self):
        result = subprocess.run(['node','scripts/inspect-data-status.mjs','--markdown','--expected-market-date','2026-10-02'],cwd=ROOT,text=True,capture_output=True,check=True)
        self.assertTrue(result.stdout.startswith('---\n'),result.stdout[:200])
        self.assertIn('기대 시장 기준일: 2026-10-02',result.stdout)
        self.assertIn('[[10-Projects/kr-market-brain/wiki/index',result.stdout)
        self.assertIn('source-code/data/raw/ma-monitor/crossovers/latest.json',result.stdout)
        self.assertIn('SHA256',result.stdout)
        self.assertNotIn('/Users/',result.stdout)

    def test_json_report_uses_declared_reference_and_rejects_invalid_reference(self):
        result = subprocess.run(['node','scripts/inspect-data-status.mjs','--expected-market-date','2026-10-02'],cwd=ROOT,text=True,capture_output=True,check=True)
        data=json.loads(result.stdout)
        self.assertEqual(data['expectedMarketDate'],'2026-10-02')
        self.assertEqual(next(x for x in data['datasets'] if x['id']=='cross')['ageDays'],0)
        bad = subprocess.run(['node','scripts/inspect-data-status.mjs','--expected-market-date','2026-02-30'],cwd=ROOT,text=True,capture_output=True)
        self.assertNotEqual(bad.returncode,0)

if __name__ == '__main__': unittest.main()
