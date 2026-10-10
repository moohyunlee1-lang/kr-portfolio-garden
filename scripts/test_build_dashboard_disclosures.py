import importlib.util, sqlite3, tempfile, unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location("builder", Path(__file__).with_name("build-dashboard-disclosures.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
class SnapshotTests(unittest.TestCase):
 def test_only_public_allowlisted_fields_and_latest_important_titles(self):
  with tempfile.TemporaryDirectory() as tmp:
   path = Path(tmp)/"dart.db"
   c = sqlite3.connect(path)
   c.execute("create table filings(stock_code text,title text,rcept_no text,raw_xml text)")
   c.executemany("insert into filings values(?,?,?,?)", [("005930","시설투자결정","20260520000123","SECRET"),("005930","정기보고서","20260521000123","SECRET"),("bad","시설투자결정","20260520000124","SECRET")])
   c.commit(); c.close()
   data = builder.build(path, None)
   self.assertEqual(len(data["items"]),1)
   self.assertEqual(data["items"][0]["ticker"],"005930")
   self.assertEqual(data["items"][0]["publishedAt"],"2026-05-20")
   self.assertNotIn("SECRET",str(data))
   self.assertNotIn(str(path),str(data))
if __name__ == "__main__": unittest.main()
