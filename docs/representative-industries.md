# 대표업종 v1 — 투자테마와 분리

## 데이터 계약

- `src/data/representative-industries.v1.json`: 공개 KRX KIND 상장법인목록을 사용한 별도 업종 스냅샷. `representativeIndustry`는 종목별 하나, `subsector`는 원문 업종, `themes`는 기존 chain-gardens의 복수 소속이다.
- `src/data/industry-taxonomy.v1.json`: **원문 업종 정확 일치** → 집계용 대표업종 규칙. 회사명/기존 테마/주가로 분류하지 않는다.
- `Quote.sector`, `Position.sector`, `canonical-sectors.generated.json` 및 value-chain 정원은 그대로 둔다. `sync-wiki-quotes.py`, `build-valuechain-gardens.py`가 canonical theme map을 재생성해도 대표업종 스냅샷은 별도 파일이라 보존된다.
- 대시보드 생성과 새로고침만 `representativeIndustries`를 사용한다. 기존 `DashboardStock.sector`는 이 화면 내 집계 키이며 Position.sector를 수정하지 않는다. 주식 금액·수량·랭크 계산 변경 없음.
- 공식 업종을 집계하는 관점이지 최신 매출 구성/주력사업을 종목별 실사한 관점이 아니다. 삼성전자처럼 투자테마와 공급자 업종이 다른 사례는 공급자 분류를 우선하며 반도체 테마를 지우지 않는다.

## 소스

공식 원문: <https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13>

v1 수집: `2026-10-09T19:29:47+09:00`. EUC-KR HTML, 원문 2,801행, 동일 코드/분류 필드 중복 43행, 서로 다른 코드 2,758개. 앱 미등재 코드 19개까지 합집합 2,777개 레코드. SHA256은 스냅샷 `rawSourceSha256`에 보존한다.

KIND가 제공하지 않는 업종 코드(`rawIndustryCode`)·업종 유효일(`providerAsOf`)은 null이다. `fetchedAt`은 실제 수집 시각이지 분류 변경일이 아니다. 원문 회사명, 업종, 주요제품, sourceUrl, 분류 상태와 confidence를 종목별 보존한다. 전화/주소/대표자 등 불필요한 필드는 추출하지 않는다. 로컬 DART DB는 read-only로 검토만 했으며 client snapshot에 복사하지 않았다.

## 보수적 처리

- `provider-industry-mapped` / high: KIND 원문 업종의 명시적 taxonomy 매핑. high는 **공급자 연결 신뢰도**이지 최신 주력사업 검증 완료 표시가 아니다.
- `provider-products-mapped` / medium: 기타 금융업 또는 회사본부의 KIND 주요제품에 지주가 명시된 경우만 지주로 보조 분류. 주요제품에 금융지주가 명시되면 금융, 일반적인 지주 표현만 있으면 복합기업·지주로 분류한다. 후자는 비금융임을 확정한 분류가 아니며 금융/비금융 세부 유형 미확인 지주도 포함한다(예: 주요제품이 ‘지주회사’인 iM금융지주). 회사명만으로 금융 여부를 추론하거나 자회사 업종으로 넘기지 않는다.
- `ambiguous-provider-industry`: 금융/지주/사업전환이 혼재한 광범위 업종. 주요제품만으로 주력사업을 추측하지 않는다.
- `identity-review`: 코드가 일치해도 앱/공급자명이 다르면 후보만 남긴다. 정규화는 공백, `(주)`, `주식회사` 제거뿐. 영문명·약칭·사명변경을 임의 확정하지 않는다.
- `not-in-provider`: 원문 목록에 정확한 코드가 없다. 종류주/상장폐지/누락 여부 미확인.
- 후자의 상태들은 `미분류·검토 필요`로 묶는다. 새 업종의 미등록 taxonomy 규칙도 자동 추측하지 않는다. 6자리 영숫자 코드를 허용하고 잘못된 길이를 padding하지 않는다. 동일 코드의 상충 분류는 생성 중단한다.

공식 분류의 해상도에 맞게 제안 taxonomy를 보수적으로 조정했다. 일차/이차전지는 `전지`, 특정 목적을 알 수 없는 장비는 `기계·정밀장비`. 디스플레이·광학·컴퓨터 등은 `전자부품·통신장비`에 포함한다. 소프트웨어의 게임 여부나 연구개발의 바이오 여부를 추론하지 않아 각각 `소프트웨어·IT서비스`, `연구개발·전문서비스`로 둔다. 부동산/교육·사업·생활서비스/환경·자원재생/기타 운송장비/기타 제조업도 독립 그룹이다. 기타 제품 제조업을 소비재로 추측하지 않는다. 완전한 규칙은 taxonomy JSON에 있다.

## 명시적 재생성

기존 quote/theme refresh와 분리하여 실행한다. 원문과 실제 수집 시각을 먼저 기록한다. 다음 날짜/시각은 **이번 저장 원본의 재현 명령**이며 새 다운로드에는 그 실제 시각을 써야 한다.

```sh
python3 scripts/build-representative-industries.py \
  --input /path/to/kind-corporations-2026-10-09.html \
  --fetched-at '2026-10-09T19:29:47+09:00'
python3 -m unittest discover -s scripts -p test_build_representative_industries.py
npm test
npm run build
```

빌더는 저장소 경로를 자신의 위치에서 찾으며 입력 원문만 읽고 대표업종 파일 하나만 쓴다. 1,000개 미만 원문은 부분수집 가능성으로 거부한다(이것만으로 전체성 검증을 대신하지는 않음). 기존 원본 archive는 finance exports/sector-reclassification에 있으며 quote/canonical/garden 파일은 입력 전용이다. 자동 갱신하지 않는 pinned snapshot이므로 새 상장·사명 변경 후에는 공식 원문 재수집 및 검토가 필요하다.

## 감사와 화면

`INDUSTRY_AUDIT_DIR=/path/to/audit npm test`는 실제 buildDashboard의 이전 canonical vs 새 대표업종 비교 결과 `invariants.json`을 만든다. 크로스트리 현재 baseline의 933종목·기타425를 고정 회귀 검사하며 모든 종목 금액과 합계의 strict equality, 섹터 비중 100%를 확인한다. 향후 원본 정원 자체가 바뀌면 baseline 변화로 테스트를 갱신해야 하며 과거 불변식을 조용히 삭제하지 않는다.

현재 감사: 기타425 중 394개 매핑/31개 보류. 전체 CROSS 미분류61, 앱 전체 미분류167. 근거 없는 보류를 줄이기 위한 강제 매핑은 하지 않는다.

실제 화면의 생성·다운로드 버튼으로 만든 PNG/PDF/PPTX/MD 및 CSV 감사표는 active finance profile의 `exports/sector-reclassification/`에 있다. 한 장은 8/25 업종 표시, 17개 생략을 명시하고 전체 분모를 유지한다. UI와 MD는 전체 업종을 담으며 MD에 종목별 분류근거도 포함한다. footer-only-third 및 기존 확대 타이포는 바꾸지 않았다.
