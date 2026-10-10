import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('industries', Path(__file__).with_name('build-representative-industries.py'))

class IndustryTests(unittest.TestCase):
    def test_parse_public_fields_and_alphanumeric_code(self):
        self.assertTrue(SPEC.origin and Path(SPEC.origin).exists(), 'Industry builder is missing')
        module = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(module)
        text = '<table><tr>' + ''.join('<th>'+x+'</th>' for x in ['회사명','시장구분','종목코드','업종','주요제품']) + '</tr><tr><td>테스트</td><td>코스닥</td><td>0035S0</td><td>소프트웨어 개발 및 공급업</td><td>로봇 플랫폼</td></tr></table>'
        result = module.parse_kind(text)
        self.assertEqual(result, [{'ticker':'0035S0','providerName':'테스트','market':'코스닥','rawIndustry':'소프트웨어 개발 및 공급업','rawIndustryCode':None,'products':'로봇 플랫폼'}])
        self.assertEqual(module.parse_kind(text.replace('</table>', text[text.index('<tr><td>'):text.index('</table>')] + '</table>')), result)
        with self.assertRaises(ValueError):
            module.parse_kind(text.replace('0035S0', '035S0'))
        with self.assertRaises(ValueError):
            module.parse_kind(text.replace('</table>', text[text.index('<tr><td>'):text.index('</table>')].replace('로봇 플랫폼', '다른 제품') + '</table>'))

    def test_mapping_uses_provider_label_not_issuer_or_theme(self):
        module = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(module)
        self.assertTrue(hasattr(module, 'classify'), 'classification missing')
        rules = {'소프트웨어 개발 및 공급업': '소프트웨어·IT서비스'}
        self.assertEqual(module.classify('소프트웨어 개발 및 공급업', '로봇 플랫폼', rules)[0], '소프트웨어·IT서비스')
        self.assertEqual(module.classify('기타 금융업', '비금융지주회사', rules)[0], '복합기업·지주')
        self.assertEqual(module.classify('기타 금융업', '금융지주회사', rules)[0], '금융')
        self.assertEqual(module.classify('기타 금융업', '반도체, 전지', rules)[0], '미분류·검토 필요')
        self.assertEqual(module.classify('알 수 없는 신규 업종', '반도체', rules)[0], '미분류·검토 필요')

    def test_identity_missing_and_multitheme_are_explicit(self):
        module = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(module)
        self.assertTrue(hasattr(module, 'build_records'), 'record builder missing')
        source = [{'ticker': '0035S0', 'providerName': 'A', 'market': '코스닥', 'rawIndustry': '반도체 제조업', 'rawIndustryCode': None, 'products': '반도체'}]
        quotes = [{'ticker': '0035S0', 'name': 'Changed'}, {'ticker': '999999', 'name': 'Missing'}]
        themes = {'0035S0': ['반도체', '로봇']}
        records = module.build_records(source, quotes, themes, {'반도체 제조업': '반도체'}, '2026-10-09T10:00:00+00:00')
        self.assertEqual(records['0035S0']['representativeIndustry'], '미분류·검토 필요')
        self.assertEqual(records['0035S0']['status'], 'identity-review')
        self.assertEqual(records['0035S0']['candidateIndustry'], '반도체')
        self.assertEqual(records['0035S0']['themes'], ['반도체', '로봇'])
        self.assertEqual(records['999999']['status'], 'not-in-provider')
        self.assertIsNone(records['999999']['rawIndustry'])
        good = module.build_records(source, [{'ticker': '0035S0', 'name': 'A'}], themes, {'반도체 제조업': '반도체'}, 'now')
        self.assertEqual(good['0035S0']['representativeIndustry'], '반도체')
        self.assertIsNone(good['0035S0']['providerAsOf'])

if __name__ == '__main__':
    unittest.main()
