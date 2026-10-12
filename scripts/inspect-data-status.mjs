#!/usr/bin/env node
// Node >=22.18 (native TS stripping); shares the UI's freshness function.
import { readFileSync } from 'node:fs';
import { assessDataset, assessFreshness } from '../src/lib/data-status.ts';
const args = process.argv.slice(2);
function option(name) {
  const i=args.indexOf(name);
  if (i < 0) return null;
  if (!args[i+1] || args[i+1].startsWith('--')) throw new Error(`Missing value: ${name}`);
  return args[i+1];
}
const manifest = JSON.parse(readFileSync(option('--manifest') || new URL('../src/data/data-status.v1.json', import.meta.url)));
const policy = JSON.parse(readFileSync(new URL('../src/data/data-status-policy.v1.json', import.meta.url)));
const now = new Date().toISOString();
const expectedMarketDate = option('--expected-market-date') || policy.expectedMarketDate;
if (expectedMarketDate && (!/^\d{4}-\d{2}-\d{2}$/.test(expectedMarketDate) || assessFreshness({available:true,sourceAsOf:expectedMarketDate,complete:true},now,Number.MAX_SAFE_INTEGER).status === 'unknown')) throw new Error('Invalid/future declared market date');
const report = { assessedAt: now, generatedAt: manifest.generatedAt, contentSha256: manifest.contentSha256, calendar: policy.calendar, expectedMarketDate,
  entityCount: Object.keys(manifest.entities).length,
  datasets: manifest.datasets.map(d => ({ ...d, ...assessDataset(d, d.id, now, policy.maxAgeDays[d.id], expectedMarketDate) })) };
if (args.includes('--markdown')) {
  const cell = x => String(x ?? '미상').replaceAll('|','\\|').replaceAll('\n',' ');
  const lines = ['---','title: 데이터 상태와 근거 탐색 v1',`created: ${now}`,`updated: ${now}`,'type: summary','tags: [stock, korea, dataset, tool]','confidence: medium','---','','# 데이터 상태와 근거 탐색 v1','',
    `- 보고서 생성: ${now}`,`- 매니페스트 생성: ${manifest.generatedAt}`,`- 기대 시장 기준일: ${expectedMarketDate ?? '미설정 — 일별 최신성 미검증'}`,
    '- 기대일은 운영자 선언이며 KRX 거래일 달력 자동 검증이 아니다. 화면/보고서 생성일은 시장 기준일이 아니다.',
    `- 공개 원천 ${report.datasets.length}종류 중 산출물 있음 ${report.datasets.filter(d=>d.available).length}종류 · 통합 종목 키 ${report.entityCount}개 (전 시장 완전성 주장이 아님).`,
    '- [[10-Projects/kr-market-brain/wiki/index|위키 홈]] · [[10-Projects/kr-market-brain/wiki/sources|기존 원천 목록]] · [[10-Projects/kr-market-brain/wiki/ma-monitor/index|MA 감시]]',
    '- 앱 경로: `/data-status` → 신호/분류 소속 → 종목 → 원천 감사 / KIND 목록 / 접수번호별 DART 원문. 배포 전에는 로컬 앱에서만 제공.',
    '', '|데이터|원천 기준일|수집·추출 시각|건수|상태|경과 달력일|','|---|---|---|---:|---|---:|',
    ...report.datasets.map(d=>`|${cell(d.label)}|${cell(d.sourceAsOf)}|${cell(d.capturedAt)}|${d.count}|${d.status}${d.stale?' + stale':''}|${cell(d.ageDays)}|`),
    '', '## 원천 감사 인덱스', '', ...report.datasets.flatMap(d=>[`### ${d.label}`,`- 식별자: \`${d.sourceRef}\``,`- SHA256: \`${d.sha256 ?? '산출물 없음'}\``,`- ${d.note}`,'']),
    '## 승인·재개', '', '- 기존 build-data-status.py CLI 기본은 dry-run: 검증·차이·체크포인트만 저장. 검토 후 --approve <approvalSha256>으로 같은 체크포인트를 재개한다.',
    '- 재개 시 원천 내용·이전 정상본 hash를 다시 비교한다. 중복 코드, 날짜 후퇴, 소실, complete→partial, 유효 범위 감소, 형식 오류는 거부하며 마지막 정상본을 보존한다.',
    '- 최신 실패는 로컬 JSONL 감사에서 확인한다. UI는 마지막 게시본이며 감사와 게시 파일의 원자적 다중파일 트랜잭션은 아니다.',
    '- 컬렉터 자동 실행·복구, cron, 실제 거래일 확정, 위키 전체 페이지 갱신은 미포함. 공시 배경 원문은 기술 신호 원봉 증거가 아니며 분류 소속은 공급·고객 관계가 아니다.',
    '',`매니페스트 content SHA256: \`${manifest.contentSha256}\``, ''];
  console.log(lines.join('\n'));
} else console.log(JSON.stringify(report, null, 2));
if (args.includes('--strict') && report.datasets.some(d => d.status !== 'fresh')) process.exitCode = 2;
