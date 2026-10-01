import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("daily-refresh.py")
spec = importlib.util.spec_from_file_location("daily_refresh", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


class YahooQuoteTest(unittest.TestCase):
    def test_skips_non_equity_ks_collision_before_using_kosdaq_equity(self):
        def fake_http_json(url, *args, **kwargs):
            if url.endswith("378800.KS?interval=1d&range=5d"):
                meta = {
                    "instrumentType": "MUTUALFUND",
                    "regularMarketPrice": 2790,
                    "regularMarketChangePercent": -10,
                    "regularMarketVolume": 1,
                }
            else:
                meta = {
                    "instrumentType": "EQUITY",
                    "regularMarketPrice": 2490,
                    "regularMarketChangePercent": 0,
                    "regularMarketVolume": 92974,
                }
            return {"chart": {"result": [{"meta": meta}]}}

        with patch.object(module, "http_json", side_effect=fake_http_json):
            quote = module.yahoo_quote("378800")

        self.assertEqual(quote["lastPrice"], 2490)
        self.assertEqual(quote["source"], "yahoo")


if __name__ == "__main__":
    unittest.main()
