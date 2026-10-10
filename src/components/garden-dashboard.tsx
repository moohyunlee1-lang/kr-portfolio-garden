"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Garden } from "../lib/types";
import { representativeIndustries, industryNotice } from "../lib/representative-industry";
import {
  buildDashboard,
  descending,
  money,
  percent,
  rankedStocks,
  type Dashboard,
  type DashboardStock,
  type Totals,
} from "../lib/dashboard";
import { reportSections } from "../lib/dashboard-report";
import type { Research } from "../lib/dashboard-research";
import type { ExportFormat } from "../lib/dashboard-export";
import { loadQuoteBatches } from "../lib/quote-batches";
import type { LiveQuote } from "../lib/market/types";
import styles from "./garden-dashboard.module.css";

const baseNotice = industryNotice + " " +
  "시세 출처: 기본 시세 스냅샷 또는 /api/quotes (KIS→Yahoo→pykrx→Naver). 정원에 현재 적용된 시세의 사본입니다. 개별 공급자 및 기본 시세의 가격 시각은 원본 미제공이며, 세션 조회 시세도 지연될 수 있습니다. 생성 시각은 거래 시각이 아닙니다. 새로고침은 이 정원의 심긴 종목만 조회합니다.";
export function GardenDashboard({
  garden,
  liveCount = 0,
}: {
  garden: Garden;
  liveCount?: number;
}) {
  const [snapshot, setSnapshot] = useState<Dashboard | null>(null);
  const [sector, setSector] = useState<string>();
  const [research, setResearch] = useState<Record<string, Research>>({});
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(baseNotice);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File>();
  const [exporting, setExporting] = useState(false);
  const generation = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const open = !!snapshot;
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow,
      returnFocus = trigger.current;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        generation.current++;
        setSnapshot(null);
      }
      if (event.key === "Tab") {
        const items = panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
      returnFocus?.focus();
    };
  }, [open]);
  function generate() {
    generation.current++;
    setSnapshot(buildDashboard(garden, representativeIndustries, new Date().toISOString()));
    setSector(undefined);
    setResearch({});
    setFile(undefined);
    setError("");
    setLoading(false);
    setExporting(false);
    setNotice(
      `현재 세션 시세 적용 ${liveCount}/${new Set(garden.positions.map((p) => p.ticker)).size}종목. ${baseNotice}`,
    );
  }
  async function analyze(name: string, force = false) {
    setSector(name);
    setFile(undefined);
    setError("");
    const token = ++generation.current;
    setExporting(false);
    if ((research[name] && !force) || !snapshot) {
      setLoading(false);
      return;
    }
    // A forced attempt has its own coverage; old rows are not current results.
    setResearch((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setLoading(true);
    const codes = snapshot.sectors
      .find((s) => s.name === name)!
      .stocks.map((s) => s.ticker);
    let result: Research | undefined;
    try {
      // Sequential batches keep news provider requests bounded (server has three workers).
      for (let i = 0; i < codes.length; i += 20) {
        if (token !== generation.current) return;
        const batch = codes.slice(i, i + 20);
        try {
          const response = await fetch(
            `/api/dashboard-research?tickers=${batch.join(",")}`,
            { signal: AbortSignal.timeout(65000) },
          );
          if (!response.ok) throw new Error("공시·뉴스 조회 실패");
          const data = (await response.json()) as Research;
          if (token !== generation.current) return;
          const stocks = data.stocks.filter((s) => batch.includes(s.ticker));
          result = { ...data, stocks: [...(result?.stocks ?? []), ...stocks] };
          const published = result;
          setResearch((current) => ({ ...current, [name]: published }));
        } catch {
          // A failed batch must not discard earlier results or prevent later requests.
          if (token !== generation.current) return;
        }
      }
      if (token === generation.current) {
        const missing = codes.filter(
          (code) => !result?.stocks.some((s) => s.ticker === code),
        );
        if (missing.length)
          setError(
            `공시·뉴스 미조회/조회실패 ${missing.length}/${codes.length}종목: ${missing.join(", ")}. 다시 분석을 눌러 재시도하세요.`,
          );
      }
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }
  async function refresh() {
    const token = ++generation.current;
    setLoading(true);
    setError("");
    setFile(undefined);
    const source = structuredClone(garden),
      received = new Map<string, LiveQuote>();
    await loadQuoteBatches(
      [...new Set(source.positions.map((p) => p.ticker))],
      async (codes) => {
        const r = await fetch(`/api/quotes?tickers=${codes.join(",")}`, {
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) throw new Error("시세 조회 실패");
        return (await r.json()).quotes as LiveQuote[];
      },
      (rows) => {
        for (const r of rows)
          if (Number.isFinite(r.lastPrice) && r.lastPrice > 0)
            received.set(r.ticker, r);
      },
      () => token !== generation.current,
    );
    if (token !== generation.current) return;
    for (const p of source.positions) {
      const q = received.get(p.ticker);
      if (q) p.lastPrice = q.lastPrice;
    }
    setSnapshot(buildDashboard(source, representativeIndustries, new Date().toISOString()));
    setSector(undefined);
    setResearch({});
    setLoading(false);
    setNotice(
      `새로 조회 성공 ${received.size}/${new Set(source.positions.map((p) => p.ticker)).size}종목. 누락은 기존 적용 시세 유지. ${baseNotice}`,
    );
  }
  function download(value: File) {
    const url = URL.createObjectURL(value),
      a = document.createElement("a");
    a.href = url;
    a.download = value.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function prepare(format: ExportFormat) {
    if (!snapshot) return;
    const token = generation.current;
    setExporting(true);
    setError("");
    setFile(undefined);
    try {
      const { exportReport } = await import("../lib/dashboard-export");
      const blob = await exportReport(
        format,
        snapshot,
        reportSections(
          snapshot,
          sector,
          sector ? research[sector] : undefined,
          notice,
        ),
      );
      if (token !== generation.current) return;
      const value = new File(
        [blob],
        `그루밭-${snapshot.name.replace(/[^\p{L}\p{N}_-]/gu, "_").slice(0, 60)}-${sector ?? "전체"}-${snapshot.createdAt.slice(0, 10)}.${format}`,
        { type: blob.type },
      );
      setFile(value);
      download(value);
    } catch {
      if (token !== generation.current) return;
      setError(
        "파일 생성 실패. 네트워크/글꼴 로드를 확인한 후 다시 시도하세요.",
      );
    } finally {
      if (token === generation.current) setExporting(false);
    }
  }
  async function share() {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: "그루밭 정원 스냅샷" });
      } catch (e) {
        if (!(e instanceof Error && e.name === "AbortError")) {
          download(file);
          setError("파일 공유 불가: 대신 다운로드했습니다.");
        }
      }
    } else {
      download(file);
      setError("이 브라우저는 파일 공유를 지원하지 않아 다운로드했습니다.");
    }
  }
  const selected = snapshot?.sectors.find((s) => s.name === sector);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="min-h-11 rounded-full bg-[#6f9a58] px-4 text-sm font-medium text-white"
        onClick={generate}
      >
        대시보드 생성하기
      </button>
      {snapshot &&
        createPortal(
          <div className={styles.overlay}>
            <div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dashboard-title"
              tabIndex={-1}
              className={styles.panel}
            >
              <header className={styles.header}>
                <div>
                  <p className="font-display">그루밭 · {snapshot.name}</p>
                  <h1 id="dashboard-title" className="font-display">
                    {sector ? `${sector} · 섹터 분석` : "정원 대시보드"}
                  </h1>
                  <p>
                    스냅샷{" "}
                    {new Date(snapshot.createdAt).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}{" "}
                    KST · 자동 갱신 없음
                  </p>
                </div>
                <button
                  onClick={() => {
                    generation.current++;
                    setSnapshot(null);
                  }}
                  aria-label="닫기"
                >
                  닫기 ×
                </button>
              </header>
              <nav className={styles.actions} aria-label="대시보드 작업">
                {sector && (
                  <button
                    onClick={() => {
                      generation.current++;
                      setLoading(false);
                      setExporting(false);
                      setSector(undefined);
                      setFile(undefined);
                    }}
                  >
                    ← 정원 전체
                  </button>
                )}
                <button
                  disabled={loading || exporting}
                  onClick={() => void refresh()}
                >
                  시세 새로고침 · 재생성
                </button>
                {(["pdf", "pptx", "png", "md"] as const).map((f) => (
                  <button
                    key={f}
                    disabled={loading || exporting}
                    onClick={() => void prepare(f)}
                  >
                    {f.toUpperCase()} {f === "md" ? "전체" : "가로 한 장"} 다운로드
                  </button>
                ))}
                {file && (
                  <button onClick={() => void share()}>
                    생성 파일 공유 ·{" "}
                    {file.name.split(".").at(-1)?.toUpperCase()}
                  </button>
                )}
              </nav>
              <p className={styles.note}>{notice}</p>
              <p className={styles.note}>
                매수원금 기준 수익률 · 배당/수수료/세금 제외 · 금액: 억원(소수
                둘째 자리). 미확인 값은 —, 시세 누락 시 합계·비중도 —.
                섹터는 대표업종 기준이며 투자테마·정원 소속과 별개입니다.
              </p>
              {(loading || exporting) && (
                <p role="status">
                  {exporting
                    ? "전체 페이지 파일을 만드는 중…"
                    : "자료를 조회하는 중…"}
                </p>
              )}
              {error && (
                <p role="alert" className={styles.warning}>
                  {error}
                </p>
              )}
              <Summary value={selected ?? snapshot} />
              {!snapshot.stocks.length && <p>아직 심긴 종목이 없습니다.</p>}
              {!selected ? (
                <>
                  <section className={styles.section}>
                    <h2 className="font-display">
                      섹터 목록 · {snapshot.sectors.length}섹터 / 총{" "}
                      {snapshot.stocks.length}종목
                    </h2>
                    <div className={styles.sectorGrid}>
                      {snapshot.sectors.map((s) => (
                        <button
                          key={s.name}
                          className={styles.sectorButton}
                          onClick={() => void analyze(s.name)}
                          aria-label={`${s.name} 분석`}
                        >
                          <strong>{s.name}</strong>
                          <span>{s.stocks.length}종목 · 분석 →</span>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className={styles.section}>
                    <h2 className="font-display">
                      섹터 비중 · 평가액 내림차순
                    </h2>
                    <Paged
                      rows={snapshot.sectors}
                      label="섹터 비중"
                      render={(s) => (
                        <Metric
                          name={s.name}
                          value={percent(s.weightPct)}
                          detail={`평가액 ${money(s.marketValue)}`}
                          bar={s.weightPct}
                        />
                      )}
                    />
                  </section>
                  <section className={styles.section}>
                    <h2 className="font-display">
                      섹터 수익률 · 매수원금 대비
                    </h2>
                    <Paged
                      rows={[...snapshot.sectors].sort((a, b) =>
                        descending(a.returnPct, b.returnPct),
                      )}
                      label="섹터 수익률"
                      render={(s) => (
                        <Metric
                          name={s.name}
                          value={percent(s.returnPct)}
                          detail={`손익 ${money(s.profit)} · 원금 ${money(s.cost)}`}
                          tone={s.returnPct}
                        />
                      )}
                    />
                  </section>
                  <section className={styles.section}>
                    <h2 className="font-display">종목 상위30 · 하위30</h2>
                    <p className={styles.note}>
                      중복 없이 최대 60종목. 60종목 이하는 전체 순위, 미확인
                      수익률은 제외합니다.
                    </p>
                    <Paged
                      rows={rankedStocks(snapshot.stocks)}
                      label="종목 순위"
                      render={(s) => (
                        <Metric
                          name={`${s.rank}위 · ${s.name} (${s.ticker})`}
                          value={percent(s.returnPct)}
                          detail={`${s.sector} · 손익 ${money(s.profit)}`}
                          tone={s.returnPct}
                        />
                      )}
                    />
                  </section>
                </>
              ) : (
                <>
                  <section className={styles.section}>
                    <h2 className="font-display">
                      종목 비중 · {selected.stocks.length}종목 · 평가액 내림차순
                    </h2>
                    <Paged
                      key={`${sector}-weight`}
                      rows={[...selected.stocks].sort((a, b) =>
                        descending(a.marketValue, b.marketValue),
                      )}
                      label="종목 비중"
                      render={(s) => (
                        <Metric
                          name={`${s.name} (${s.ticker})`}
                          value={percent(
                            selected.marketValue && s.marketValue != null
                              ? (s.marketValue / selected.marketValue) * 100
                              : null,
                          )}
                          detail={`평가액 ${money(s.marketValue)}`}
                          bar={
                            selected.marketValue && s.marketValue != null
                              ? (s.marketValue / selected.marketValue) * 100
                              : null
                          }
                        />
                      )}
                    />
                  </section>
                  <section className={styles.section}>
                    <h2 className="font-display">종목 수익률 · 내림차순</h2>
                    <Paged
                      key={`${sector}-return`}
                      rows={[...selected.stocks].sort((a, b) =>
                        descending(a.returnPct, b.returnPct),
                      )}
                      label="종목 수익률"
                      render={(s) => (
                        <Metric
                          name={`${s.name} (${s.ticker})`}
                          value={percent(s.returnPct)}
                          detail={`손익 ${money(s.profit)} · 평가액 ${money(s.marketValue)}`}
                          tone={s.returnPct}
                        />
                      )}
                    />
                  </section>
                  <section className={styles.section}>
                    <h2 className="font-display">종목별 중요공시 · 뉴스</h2>
                    <p className={styles.warning}>
                      공시는 로컬 DB에서 게시한 과거 기록입니다. 아래 DB 최신
                      공시일을 확인하세요. 최근 90일 외 자료는 과거 공시로
                      표시하며, 최근 공시의 완전성을 보장하지 않습니다.
                    </p>
                    <button
                      disabled={loading}
                      onClick={() => void analyze(sector!, true)}
                    >
                      다시 분석
                    </button>
                    {research[sector!] && (
                      <div className={styles.note}>
                        <p>
                          공시 스냅샷 생성 {research[sector!].generatedAt} ·
                          뉴스 조회 {research[sector!].fetchedAt}
                        </p>
                        {research[sector!].sources.map((s) => (
                          <p key={s.name}>
                            {s.name} · DB 최신 공시일 {s.latestFilingDate} ·{" "}
                            {s.rowsExamined}건 확인
                          </p>
                        ))}
                        <p>
                          {research[sector!].policy} · Naver 종목 뉴스 API 최신
                          3개 제목 (중요도·정확성 보장 안 함). 로컬 디스크에
                          대한 원격 접근 없이 버전 스냅샷 사용.
                        </p>
                      </div>
                    )}
                    <Paged
                      key={`${sector}-research`}
                      rows={selected.stocks}
                      label="종목 공시 뉴스"
                      size={10}
                      render={(s) => (
                        <StockNews
                          stock={s}
                          research={research[sector!]}
                          createdAt={snapshot.createdAt}
                        />
                      )}
                    />
                  </section>
                </>
              )}
              <footer className={styles.note}>
                PDF/PPTX/PNG는 가로 한 장 요약(표시 개수 명시), MD는 전체 상세입니다. 정원 전체에서는
                대시보드1, 섹터 분석에서는 선택 섹터 대시보드2를 저장합니다.
                파일에 보유 금액이 포함됩니다. URL 대신 파일을 공유하세요.
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
function Summary({ value }: { value: Totals }) {
  return (
    <div className={styles.summary}>
      {[
        ["총평가액", money(value.marketValue)],
        ["평가손익", money(value.profit)],
        ["총수익률", percent(value.returnPct)],
        ["매수원금", money(value.cost)],
      ].map(([label, text]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{text}</strong>
        </div>
      ))}
    </div>
  );
}
function Metric({
  name,
  value,
  detail,
  bar,
  tone,
}: {
  name: string;
  value: string;
  detail: string;
  bar?: number | null;
  tone?: number | null;
}) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricTop}>
        <strong>{name}</strong>
        <b className={tone == null ? "" : tone >= 0 ? "pnl-up" : "pnl-down"}>
          {value}
        </b>
      </div>
      <p>{detail}</p>
      {bar != null && (
        <div className={styles.track}>
          <div style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </div>
      )}
    </div>
  );
}
function Paged<T>({
  rows,
  label,
  render,
  size = 30,
}: {
  rows: T[];
  label: string;
  render: (row: T) => React.ReactNode;
  size?: number;
}) {
  const [page, setPage] = useState(0),
    count = Math.max(1, Math.ceil(rows.length / size)),
    current = Math.min(page, count - 1);
  return (
    <>
      <div>
        {rows.slice(current * size, (current + 1) * size).map((row, i) => (
          <div key={current * size + i}>{render(row)}</div>
        ))}
      </div>
      {count > 1 && (
        <nav className={styles.pagination} aria-label={`${label} 페이지`}>
          <button disabled={!current} onClick={() => setPage(current - 1)}>
            {label} 이전
          </button>
          <span>
            {current + 1} / {count}
          </span>
          <button
            disabled={current >= count - 1}
            onClick={() => setPage(current + 1)}
          >
            {label} 다음
          </button>
        </nav>
      )}
    </>
  );
}
function StockNews({
  stock,
  research,
  createdAt,
}: {
  stock: DashboardStock;
  research?: Research;
  createdAt: string;
}) {
  const r = research?.stocks.find((s) => s.ticker === stock.ticker);
  return (
    <article className={styles.news}>
      <h3>
        {stock.name} ({stock.ticker})
      </h3>
      {r?.disclosures.length ? (
        r.disclosures.map((i) => (
          <p key={i.url}>
            <span>
              {Date.parse(createdAt) - Date.parse(i.publishedAt) > 90 * 86400000
                ? "과거 공시"
                : "공시"}{" "}
              · {i.publishedAt}
            </span>
            <a href={i.url} target="_blank" rel="noopener noreferrer">
              {i.title} ↗
            </a>
          </p>
        ))
      ) : (
        <p>
          {r
            ? "공시: 게시 스냅샷에 기록 없음 (공시가 없다는 뜻 아님)"
            : "공시: 미조회/조회실패"}
        </p>
      )}
      {r?.news.length ? (
        r.news.map((i) => (
          <p key={i.url}>
            <span>
              뉴스 · {i.source} · {i.publishedAt}
            </span>
            <a href={i.url} target="_blank" rel="noopener noreferrer">
              {i.title} ↗
            </a>
          </p>
        ))
      ) : (
        <p>
          뉴스:{" "}
          {r?.newsStatus === "empty" ? "API 결과 없음" : "조회 실패/미조회"}
        </p>
      )}
    </article>
  );
}
