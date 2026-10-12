"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { assessDataset, type FreshnessInput } from "../lib/data-status";
import policy from "../data/data-status-policy.v1.json";
import styles from "./data-status.module.css";

type Dataset = FreshnessInput & { id: string; label: string; provider: string; count: number; scanned: number | null; successful: number | null; sha256: string | null; sourceRef: string; note: string };
type Entity = { memberships?: { gardenId: string; label: string; recordPointer: string }[]; ticker: string; name: string; signals: { dataset: string; kind: string; sourceAsOf: string; eventDate: string | null }[]; industry: { representativeIndustry: string | null; rawIndustry: string | null; status: string | null; confidence: string | null; reason: string | null; sourceUrl: string | null } | null; disclosures: { title: string; publishedAt: string; url: string | null }[] };
export type StatusManifest = { schemaVersion: number; generatedAt: string; contentSha256: string; datasets: Dataset[]; entities: Record<string, Entity> };
const labels = { fresh: "fresh · 기준 내", stale: "stale · 오래됨", partial: "partial · 부분", missing: "missing · 없음", unknown: "unknown · 미상" };

export function DataStatusView({ manifest, now, initialQuery = "" }: { manifest: StatusManifest; now: string; initialQuery?: string }) {
  const [expectedMarketDate, setExpectedMarketDate] = useState<string>(policy.expectedMarketDate ?? "");
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(12);
  const matches = useMemo(() => Object.values(manifest.entities).filter(e => (!query || `${e.ticker} ${e.name}`.toLowerCase().includes(query.trim().toLowerCase())) && (!filter || (filter === "memberships" ? !!e.memberships?.length : e.signals.some(s => s.dataset === filter)))), [manifest, query, filter]);
  const entity = selected ? manifest.entities[selected] : null;
  return <main className={styles.page}>
    <Link href="/">← 그루밭</Link>
    <h1 className="font-display">데이터 상태 / 근거</h1>
    <p>저장 스냅샷의 시점·누락·원문 경로입니다. 실시간 시세 화면이나 전 시장 검증 완료 표시가 아닙니다.</p>
    <p className={styles.muted}>매니페스트 생성: {manifest.generatedAt} · 상태 평가: {now}<br />생성 시각 ≠ 시장 기준일 · {policy.calendar}</p>
    <label>기대 시장 기준일 (운영자 확인) <input type="date" value={expectedMarketDate} onChange={e => setExpectedMarketDate(e.target.value)} /></label>
    <p>거래소 달력 자동 확인 아님. 가격·일별 신호는 명시한 기준일과 비교합니다. 미설정 시 최신성 미검증이며 부분·누락은 별도 유지합니다. 공시·업종은 상태 평가 시각의 달력일 기준입니다.</p>
    <div className={styles.grid}>
      {manifest.datasets.map(d => {
        const threshold = policy.maxAgeDays[d.id as keyof typeof policy.maxAgeDays];
        const state = assessDataset(d, d.id, now, threshold, expectedMarketDate || null);
        return <section id={`dataset-${d.id}`} key={d.id} className={styles.card}>
          <h2>{d.label}</h2>
          <span className={styles.badge} data-status={state.status}>{labels[state.status]}</span>{state.stale && state.status !== "stale" && <span className={styles.badge} data-status="stale">stale · 오래됨</span>}
          <dl><dt>원천 기준일</dt><dd>{d.sourceAsOf ?? "미제공 / 미상"}</dd><dt>수집·추출 시각</dt><dd>{d.capturedAt ?? "미기록"}</dd><dt>경과 / 허용 기준</dt><dd>{state.ageDays === null ? "계산 불가" : `${state.ageDays} 달력일`} / {threshold} 달력일</dd><dt>수록 건수</dt><dd>{d.available ? d.count : "—"}</dd>{d.scanned !== null && <><dt>유효 / 스캔</dt><dd>{d.successful} / {d.scanned}</dd></>}</dl>
          <p>{d.provider}</p><p className={styles.muted}>{d.note}</p>
          {(d.id === "ma" || d.id === "cross") && <a href="#source-search" onClick={() => { setFilter(d.id); setQuery(""); setLimit(12); setSelected(null); }}>신호 → 종목 → 근거 탐색</a>}
          {d.id === "memberships" && <a href="#source-search" onClick={() => { setFilter("memberships"); setQuery(""); setLimit(12); setSelected(null); }}>분류 소속 → 종목 → 근거 탐색</a>}
          <details><summary>출처 식별자 / SHA256</summary><p className={styles.code}>{d.sourceRef}</p><p className={styles.code}>{d.sha256 ?? "산출물 없음"}</p><p>프로젝트 상대 식별자입니다. 로컬 파일 링크가 아니며 원문 전체를 공개하지 않습니다.</p></details>
        </section>;
      })}
    </div>
    <section id="source-search" className={styles.card}>
      <h2>종목별 근거 탐색</h2>
      <p>신호의 저장 관측 → 동일 종목 → 공개 업종·공시 원문. 업종·공시는 기술 신호의 원봉 검증 근거가 아닙니다.</p>
      <label>종목명 / 코드 <input type="search" value={query} onChange={e => { setQuery(e.target.value); setSelected(null); setLimit(12); }} placeholder="예: 삼성전자 또는 005930" /></label>
      <label>관찰 종류 <select value={filter} onChange={e => { setFilter(e.target.value); setLimit(12); setSelected(null); }}><option value="">전체</option><option value="memberships">밸류체인 소속</option><option value="ma">MA</option><option value="cross">20/60 크로스</option></select></label>
      <p aria-live="polite">{matches.length ? `검색 ${matches.length}종목 · 표시 ${Math.min(limit, matches.length)}종목` : "검색 결과 없음"}</p>
      <div className={styles.results}>{matches.slice(0, limit).map(e => <button key={e.ticker} onClick={() => setSelected(e.ticker)} aria-expanded={selected === e.ticker}>{e.name || "이름 미수록"} {e.ticker} 근거 보기</button>)}</div>
      {matches.length > limit && <button onClick={() => setLimit(limit + 24)}>24종목 더 보기</button>}
      {entity && <article className={styles.detail} aria-label={`${entity.name} 근거`}>
        <h3>{entity.name || "이름 미수록"} · {entity.ticker}</h3>
        <p>가격 기준일: 미상 · 개별 가격 시각 미제공. 기본 가격과 현재 세션 시세는 별도입니다.</p>
        <h4>밸류체인 분류 소속</h4>
        <p>기존 공개 정원의 소속 관계입니다. 공급·고객 관계가 아닙니다. 개인 정원 수정은 이 스냅샷에 포함하지 않습니다.</p>
        {entity.memberships?.length ? <ul>{entity.memberships.map(m => <li key={m.gardenId}><Link href={`/garden/${m.gardenId}`}>{m.label} 정원</Link> · <a href="#dataset-memberships">소속 원천 감사</a><p className={styles.code}>JSON Pointer: {m.recordPointer}</p></li>)}</ul> : <p>분류 소속 미수록</p>}
        <h4>저장 신호</h4>
        {entity.signals.length ? entity.signals.map((s, i) => <p key={i}><a href={`#dataset-${s.dataset}`}>{s.dataset.toUpperCase()} 원천 감사</a> · {s.kind} · 관찰 기준일 {s.sourceAsOf}{s.eventDate && ` · 교차일 ${s.eventDate}`}<br />공개 원봉 URL 미제공 · 위 데이터셋 SHA256의 선택 필드입니다.</p>) : <p>수록 신호 없음 (현재 신호 부재를 뜻하지 않음)</p>}
        <h4>대표업종 · 원문 매핑</h4>
        {entity.industry ? <><p>{entity.industry.representativeIndustry ?? "미분류"} ← {entity.industry.rawIndustry ?? "원문 업종 없음"}</p><p>{entity.industry.status} · confidence {entity.industry.confidence ?? "미상"}</p><p>{entity.industry.reason}</p>{entity.industry.sourceUrl ? <a href={entity.industry.sourceUrl} target="_blank" rel="noopener noreferrer">KIND 원문 목록 (개별 종목 상세 아님)</a> : <p>안전한 공개 출처 URL 없음</p>}</> : <p>대표업종 근거 미수록</p>}
        <h4>공시 원문 · 기업 배경 자료</h4>
        {entity.disclosures.length ? <ul>{entity.disclosures.map((d,i) => <li key={i}>{d.publishedAt} · {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer">{d.title} · DART 원문</a> : `${d.title} · 안전한 원문 URL 미확보`}</li>)}</ul> : <p>이 스냅샷에 공시 미수록 (공시가 없다는 뜻 아님)</p>}
      </article>}
    </section>
    <section className={styles.card}><h2>갱신 승인 기준 · v1</h2><p>로컬 생성기는 잘못된 형식·전부 실패한 MA/크로스·기준일 후퇴·기존 원천 소실을 거부하고 마지막 정상 매니페스트를 보존합니다. 기존보다 범위가 줄거나 complete→partial이면 거부합니다. CLI 기본은 검증·차이·체크포인트만 저장하며 승인 해시가 있어야 게시합니다. 같은 체크포인트 재개는 입력·이전 승인본 해시를 재검증하며 동일 입력 재개는 내용을 바꾸지 않습니다.</p><p>이 페이지는 마지막 승인된 매니페스트입니다. 마지막 생성 후 실패한 실행은 로컬 JSONL 감사에서 확인해야 하며, 수집기 자동 복구·운영 스케줄 확인은 포함하지 않습니다.</p><details><summary>상태 판정 규칙</summary><p>missing: 산출물 없음. partial: 알려진 불완전 범위(오래됨도 함께 표시). unknown: 기준일/완전성 미상 또는 미래·비정상 시각. stale: 기준일이 허용 달력일을 초과. fresh: 기준일과 완전성이 확인되고 허용 범위 내(시장 최신성 보증 아님). 수집·생성일을 기준일로 대체하지 않습니다.</p><p className={styles.code}>content SHA256: {manifest.contentSha256}</p></details></section>
  </main>;
}
