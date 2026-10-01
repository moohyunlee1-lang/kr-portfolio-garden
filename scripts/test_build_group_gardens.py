import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("build-group-gardens.py")
spec = importlib.util.spec_from_file_location("build_group_gardens", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


class GroupPositionTest(unittest.TestCase):
    def test_uses_first_session_close_for_cost_and_quantity(self):
        quote = {
            "name": "삼성전자",
            "yearOpen": 120_200,
            "yearFirstClose": 128_500,
            "yearFirstDate": "2026-01-02",
        }

        row = module.position("grp_samsung", "005930", quote, 0)

        self.assertEqual(row["avgCost"], 128_500)
        self.assertEqual(row["quantity"], 77)

    def test_skips_position_without_first_session_close(self):
        quote = {"name": "신규상장", "lastPrice": 20_000}

        self.assertIsNone(module.position("grp_new", "0126Z0", quote, 0))

    def test_skips_position_when_budget_cannot_buy_one_share(self):
        quote = {"name": "고가주", "yearFirstClose": 10_000_001, "yearFirstDate": "2026-01-02"}

        self.assertIsNone(module.position("grp_high", "999999", quote, 0))

    def test_skips_affiliate_that_first_traded_after_seed_session(self):
        quote = {"name": "신규상장", "yearFirstClose": 10_000, "yearFirstDate": "2026-03-23"}

        self.assertIsNone(module.position("grp_new", "0126Z0", quote, 0))

    def test_loads_all_ftc_groups_from_authoritative_snapshot(self):
        groups = module.ftc_groups()

        self.assertEqual(len(groups), 102)
        self.assertEqual(groups[0]["name"], "삼성")
        self.assertIn("005930", groups[0]["listedTickers"])

    def test_resolves_reviewed_ftc_group_name_aliases(self):
        self.assertEqual(module.canonical_group_name("에이치엠엠"), "HMM")
        self.assertEqual(module.canonical_group_name("현대해상화재보험"), "현대해상")
        self.assertEqual(module.canonical_group_name("에이치디씨"), "HDC")
        self.assertEqual(module.canonical_group_name("네이버"), "NAVER")
        self.assertEqual(module.canonical_group_name("에쓰-오일"), "S-Oil")


if __name__ == "__main__":
    unittest.main()