from datetime import date
import importlib.util
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).with_name("enrich-monthly.py")
spec = importlib.util.spec_from_file_location("enrich_monthly", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


class PackPeriodBaselinesTest(unittest.TestCase):
    def test_builds_week_month_and_year_baselines_from_adjusted_daily_rows(self):
        rows = [
            {"date": "2026-01-02", "open": 8745.0, "high": 9000.0, "low": 8700.0, "close": 8900.0},
            {"date": "2026-09-01", "open": 2550.0, "high": 2565.0, "low": 2440.0, "close": 2510.0},
            {"date": "2026-09-29", "open": 2800.0, "high": 3020.0, "low": 2415.0, "close": 2530.0},
            {"date": "2026-09-30", "open": 2530.0, "high": 2530.0, "low": 2445.0, "close": 2490.0},
        ]

        packed = module.pack(rows, date(2026, 9, 30))

        self.assertEqual(packed["weekOpen"], 2800.0)
        self.assertEqual(packed["monthOpen"], 2550.0)
        self.assertEqual(packed["yearOpen"], 8745.0)
        self.assertEqual(packed["yearFirstClose"], 8900.0)
        self.assertEqual(packed["yearFirstDate"], "2026-01-02")
        self.assertEqual(packed["monthClose"], 2490.0)
        self.assertEqual(packed["periodAsOf"], "2026-09-30")

    def test_ignores_zero_open_rows_from_a_trading_halt(self):
        rows = [
            {"date": "2026-09-28", "open": 0.0, "high": 0.0, "low": 0.0, "close": 2550.0},
            {"date": "2026-09-29", "open": 2800.0, "high": 3020.0, "low": 2415.0, "close": 2530.0},
        ]

        packed = module.pack(rows, date(2026, 9, 29))

        self.assertEqual(packed["weekOpen"], 2800.0)
        self.assertEqual(packed["monthOpen"], 2800.0)

    def test_records_later_first_trade_date_for_new_listing(self):
        rows = [
            {"date": "2026-03-23", "open": 10_000.0, "high": 11_000.0, "low": 9_000.0, "close": 10_500.0},
        ]

        packed = module.pack(rows, date(2026, 9, 30))

        self.assertEqual(packed["yearFirstDate"], "2026-03-23")


if __name__ == "__main__":
    unittest.main()
