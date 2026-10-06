# 포트폴리오 정원

한국 주식 포트폴리오를 3D 정원으로 보는 Next.js 앱입니다.

정원 화면 오른쪽의 **나무 도감**에서 현재 정원의 종목명·코드·현재가·평가손익률과 크로스 표식을 볼 수 있습니다. 나무를 누르면 해당 위치에 초점을 맞추고, ↗ 버튼은 상세 카드로 이동합니다. 이름/코드 검색과 60그루씩 더 보기를 지원하며 작은 화면에서는 하단 `나무 목록` 버튼으로 열 수 있습니다.

정원 하나 = 포트폴리오 하나. 나무는 종목입니다. 크기와 성장 단계는 평가금액·수익률과 같습니다.

`kr-market-brain` 9개 섹터 주밸류체인 131개를 정원으로 넣었습니다. 종목마다 2026-01-02 종가 기준 1천만원을 정수 주로 심었습니다.

## 라이딩트리와 크로스트리

`kr-market-brain/source-code/ma-monitor/main.py`가 감시 신호 상위 종목의 중복 없는 날짜별 스냅샷을 저장하면 `scripts/build-ma-garden.py --source <스냅샷 경로>`가 `src/data/ma-garden.generated.json`의 `ma_watch` 정원을 만듭니다. CLI의 기본 로컬 실행은 두 단계를 이어서 수행하며 텔레그램 전송은 하지 않습니다. 저장된 스냅샷은 단독 KIS MA 관찰이며 KRX 공식 신호나 52주 신고가 더블 체크가 아닙니다. 첫 KRX 세션 종가·종목명이 맞지 않는 종목은 `src/data/ma-garden-report.json`에 제외 사유를 남깁니다. 생성 후 배포는 별개입니다.

`python3 scripts/build-cross-garden.py`는 지정된 `kr-market-brain/.../ma-monitor/crossovers/latest.json`을 읽어 `cross_watch` 크로스트리 및 모든 정원의 종목별 골든/데드 표시를 생성합니다. 최초 입력이 없으면 빈 초기 정원을 만들지만, 이미 생성한 데이터가 있으면 입력 누락 시 덮어쓰지 않고 오류로 중단합니다. 마지막 20거래일(발생일 포함)의 교차 중 종목별 최근 신호를 유지하며, 수집 결손·제외 종목과 사유는 `src/data/cross-garden-report.json`에 기록됩니다. 두 정원 및 파이어트리는 2026-01-02 정확한 첫 세션 종가 대비 현재가로 크기를 계산하며 0.65–1.6배로 제한합니다. 파이어트리의 기존 스냅샷은 한 번만 첫 세션 종가로 재시드하고 해당 가격을 확인할 수 없는 종목은 제외합니다. 다른 정원의 기존 크기 계산은 유지됩니다. 생성 후 빌드·배포는 별개입니다.

## 코스닥 상폐위기

`kosdaq_delisting_risk`는 첨부 CSV에서 2026-10-06 KIND 관리종목 지정 `예`인 60개를 추려 만든 **가상 정원**입니다. 그중 2026-09-01 실제 거래량이 있는 종가를 Naver fchart와 Yahoo KOSDAQ 일봉에서 대조한 37개만 그 날짜에 심었습니다. 23개는 당일 거래가 없어 이월 가격을 시드 가격으로 쓰지 않았습니다. 종목마다 1천만 원 예산에서 정수 주를 산 것으로 가정하며 실제 거래내역은 아닙니다. 선정 명단은 10월 기준이므로 9월 1일 이후 관리종목으로 지정된 10개도 후보에 포함됩니다(식재 종목 중 9개). 또한 원본의 200억 미만 시총은 KIS 기준으로 KRX 공식 전종목 시총 검증이 완료되지 않았습니다.

입력 및 증빙은 `scripts/data/kosdaq-risk-kind-membership-20261006.csv`, `scripts/data/kosdaq-risk-prices-20260901.csv`에 보관합니다. `src/data/kosdaq-risk-garden-report.json`에 식재·제외 종목과 날짜·가격 출처를 기록합니다. 다시 생성하려면:

```bash
python3 scripts/build_kosdaq_risk_garden.py --members scripts/data/kosdaq-risk-kind-membership-20261006.csv --prices scripts/data/kosdaq-risk-prices-20260901.csv
```

## 로컬

```bash
npm install
npm run dev
```

## 배포

Vercel Hobby. GitHub `moohyunlee1-lang/kr-portfolio-garden`에 연동합니다.
