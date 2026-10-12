# 데이터 상태 / 근거 v1

소개 PDF의 시점 가시성·갱신 검증·근거 탐색을 연결한 **로컬 스냅샷 소비 계층**입니다. 수집기를 실행하거나 운영 스케줄을 바꾸지 않습니다.

## 사용

정원 HUD, 대시보드, 종목 카드의 **데이터 상태/근거** → `/data-status`.
종목 카드는 코드 검색을 넘깁니다. MA/크로스 카드의 **신호 → 종목 → 근거 탐색**은 해당 관찰 종류로 필터링합니다. 선택된 종목에서 원천 감사 식별자·SHA256, 실제 저장 신호/교차일, KIND 목록 및 접수번호별 DART 원문을 확인합니다.

- 공개 범위: 기존 가격 카탈로그의 종목명/코드, 대표업종의 매핑 관련 필드, 기존 공개 공시 스냅샷의 제목/날짜/URL, MA·크로스의 선택된 관측 필드만.
- 원천 경로는 프로젝트 상대 **식별자**입니다. 파일 서버/임의 경로 resolver는 없습니다. Vercel이 로컬 위키를 읽는다고 가정하지 않습니다.
- KIND 링크는 목록 단위이며 개별 기업 최신 사업 검증이 아닙니다. DART 링크는 기업 배경 공시이며 기술 신호의 원봉 증거가 아닙니다. 원봉 공개 URL 미확보를 별도 표시합니다.
- HTTPS `dart.fss.or.kr/dsaf001/main.do?rcpNo=14자리`와 KIND의 정확한 공개 목록 endpoint만 허용합니다. 인증·추가 query, localhost, file URL은 게시하지 않습니다.

## 생성과 운영 점검

저장소 루트에서, Python 3.9+ / macOS·Linux 및 Node 22.18+:

```sh
# TMPDIR은 출력과 같은 파일시스템에 있는 작업용 경로로 지정합니다.
# 아래 예시는 Hermes finance 프로필의 scratch/감사 디렉터리입니다.
export TMPDIR="$HOME/.hermes/profiles/finance/cache/scratch"
mkdir -p "$TMPDIR"
npm run data-status:build -- \
  --wiki "$HOME/wiki/10-Projects/kr-market-brain" \
  --audit "$HOME/.hermes/profiles/finance/exports/kr-market-brain-nextsteps/run-audit.jsonl" \
  --checkpoint "$HOME/.hermes/profiles/finance/exports/kr-market-brain-nextsteps/preflight.json" --dry-run
# checkpoint의 candidate/diff/baseSha256를 검토한 뒤 같은 인자로
# --dry-run 대신 --approve <checkpoint.approvalSha256> 지정하여 게시/재개.
npm run data-status:inspect
npm run data-status:inspect -- --strict
```

생성 결과는 `src/data/data-status.v1.json`. 기본 앱 입력은 스크립트 기준 저장소 상대 경로로 해석됩니다. 위키는 명시적 `--wiki`만 읽습니다. 네트워크/DB 쓰기는 없습니다. 정책은 `src/data/data-status-policy.v1.json`.

- `build` 기본은 dry-run(게시 안 함). exit 0: awaiting-approval / 승인 시 published 또는 unchanged. exit 1: 검증 거부(마지막 정상본 보존). 파일시스템 오류는 명령 실패로 처리합니다.
- `inspect` exit 0: 보고서 출력. `--strict` exit 2: 하나라도 fresh가 아님. **수집기 장애 확정 판정은 아닙니다.**
- generatedAt은 후보 매니페스트 생성 시각(게시 시각과도 구분). 체크포인트는 candidate·diff·이전 승인본 hash·승인 토큰을 보관합니다. 승인 시 입력 내용과 이전 파일 무결성을 재검증하고, 동일 체크포인트 재개는 바이트 단위 유지합니다. 토큰은 내용 검토 확인값이며 사용자 인증/암호 서명이 아닙니다.
- 각 원천 파일 SHA256과 전체 내용 hash(생성 시각 제외)를 기록합니다. JSONL 감사에는 published/unchanged/rejected, 허용된 사유 코드와 보존본 hash가 남습니다.
- 동일 출력에는 항상 같은 `--audit` 경로를 사용하세요. 그 파일의 `flock`으로 동시 생성을 직렬화합니다. 검증 완료 후 tempfile+`os.replace`로 단일 출력 파일을 원자적으로 교체합니다. 네트워크 파일시스템/다른 볼륨은 지원하지 않습니다.
- 구문/공개 필드 형식 오류, 미래·비정상 시각, 유효 관측 0인 MA/크로스, complete와 성공 범위의 모순, 이전보다 오래된 기준일, 기존 원천 소실은 게시 거부. 기존보다 유효/스캔 수가 감소하거나 complete→partial, 가격·업종·공시·소속 행수 감소도 거부합니다. 최초부터 일부 유효인 자료는 partial로 명시하고 승인 후 보존합니다. 합법적인 범위 축소는 별도 정책 검토가 필요하며 우회 플래그는 없습니다.
- 어댑터는 변환 전에 배열/객체 구조와 필수 시각을 검사합니다. MA/크로스 scanned·successful은 bool이 아닌 정수이며 `0 < successful <= scanned`여야 합니다. 업종 fetchedAt·공시 generatedAt·관측 as_of는 필수, 가격 시각과 업종 providerAsOf의 실제 미상은 null로 유지합니다.
- 롤백은 timezone-aware instant 비교이며 date-only는 KST 자정입니다. MA 신호는 touch/riding, 크로스는 golden/dead만 허용하며 crossed_on은 필수 YYYY-MM-DD이고 관측 기준일보다 미래일 수 없습니다. 공개 매니페스트에서도 시각·범위·신호를 재검증합니다.
- 최초 산출물이 없는 데이터셋은 missing으로 표현합니다. 특히 52주 dual 부재를 실패나 기존 pipeline 결과로 대체하지 않습니다. 날짜별 dual 파일이 생기면 존재/날짜/공통 일봉 통과 건수만 읽고 완전성은 unknown으로 둡니다.
- UI는 마지막 승인본만 보여줍니다. 새로 실패한 시도는 **로컬 감사**를 따로 읽어야 합니다. 감사와 출력은 하나의 DB 트랜잭션이 아니므로 시스템 중단 때는 실제 출력 hash와 감사의 마지막 published hash를 대조하세요.

## 시점 정책

공유 함수 `assessDataset`/`assessFreshness`를 UI와 inspect CLI가 함께 사용합니다. `expectedMarketDate` 기본은 null이며 가격·일별 신호는 운영자 선언 없이는 최신성 unknown(알려진 부분은 partial)을 유지합니다. UI 날짜 입력 또는 CLI `--expected-market-date YYYY-MM-DD`는 비교 기준일이며 공식 완료 거래일 검증이 아닙니다. 보고서 `--markdown`은 위키 중앙 보고서용 출력을 제공합니다. date-only는 한국 달력일, timestamp는 timezone을 요구합니다. KRX 휴장 달력은 미연동이므로 거래일 수로 표기하지 않습니다.

|종류|허용 경과(달력일)|정책|
|---|---:|---|
|가격|0|현재 저장본은 개별 가격 시각 미제공 → unknown, 나이 null. periodAsOf 재사용 금지|
|MA·크로스·52주 dual|0|명시한 기대 시장일 대비 관찰 기준일 사용, 일부 유효는 partial 및 stale 동시 표시|
|공시|7|수록 공시 최신일을 사용. 제한된 추출 범위는 항상 partial|
|대표업종|90|공급자 유효일 없음 → unknown. KIND fetchedAt을 유효일로 치환하지 않음|

missing → invalid/future unknown → 알려진 partial → stale → completeness unknown → fresh 순서의 보수적 판정입니다. 기준일 미상이면서 알려진 부분 범위이면 partial·나이 계산 불가입니다. fresh는 명시된 범위/날짜가 허용 기준 안이라는 뜻일 뿐 시장 최신성 보증이 아닙니다.

## 재현 검증

```sh
npm test
python3 -m unittest discover -s scripts -p 'test_*.py' -v
python3 scripts/verify-data-status-fixtures.py /path/to/auditfixtures
npm run build
npm start -- --hostname 127.0.0.1 --port 3041
# 별도 터미널: 기본 URL을 바꾸려면 STATUS_SMOKE_URL 지정
node scripts/smoke-data-status.mjs /path/to/evidence
```

브라우저 smoke는 데스크톱/모바일 독립 context에서 API 요청을 차단하고 **실제 저장 가격**으로 CROSS 대시보드·MD 다운로드·상태 drilldown·종목 링크와 저장 정원 불변을 검사합니다. 신선한 시세 조회 성공을 주장하지 않습니다. 기존 PDF/PPTX 한 장 구조는 전체 Vitest suite에서 회귀 검사합니다.

## 분류 관계·중앙 보고서

기존 `chain-gardens.generated.json`의 소속을 허용 필드만 읽어 `memberships`로 게시합니다. 매수일을 분류 기준일로 추정하지 않습니다. 분류 소속 → 종목 → 정원 / 소속 원천 감사의 JSON Pointer로 정확한 행과 hash를 추적합니다. 원천 전체를 서버의 임의 파일 resolver로 노출하지 않습니다. 소속 교집합은 공급·고객 edge가 아니며 private 정원 수정과 무관합니다.

`node scripts/inspect-data-status.mjs --markdown` 출력이 `wiki/_meta/data-status.md` 중앙 페이지의 생성기입니다. 중앙 위키 index와 연결했으며 수천 종목 페이지를 재작성하지 않았습니다. 가격·공시·MA·크로스 수집 CLI/DB를 새 파이프라인으로 대체하지 않고, 기존 공개 상태 생성 CLI만 확장했습니다. 기존 raw 수집기의 원자성은 이번 승인 게이트의 보장 대상이 아닙니다.

## 의도적 제외

현재 시장 데이터 재수집, 기존 collector의 transaction/재시도 재설계, 자동 cron, 공개 wiki 전체 탐색, 상세 원봉 공개, 52주 dual 수집 운영 정상화, 배포는 이번 v1에 포함하지 않습니다. 대시보드 산식·금액·정원 membership·대표업종과 테마 분리·한 장 export footer는 변경하지 않습니다.
