import { descending, money, percent, type Dashboard } from "./dashboard";
import { reportMarkdown, type ReportSection } from "./dashboard-report";
export type ExportFormat = "pdf" | "pptx" | "png" | "md";
const W = 26.6666666667,
  H = 15;
const ink = "303844",
  navy = "172D48",
  muted = "657182",
  gain = "297258",
  loss = "AB4D59";
const palette = [
  "5478B5",
  "8875A9",
  "539589",
  "B29B54",
  "B57E89",
  "708195",
  "62A0B9",
];
type TextBox = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  color: string;
  url?: string;
};
type Card = { x: number; y: number; w: number; h: number; color?: string };
function wrap(value: string, width: number, size: number) {
  const max = (width * 72) / size;
  const lines: string[] = [];
  let line = "",
    used = 0;
  for (const c of value) {
    const n = c.charCodeAt(0) > 255 ? 1 : 0.58;
    if (c === "\n" || used + n > max) {
      lines.push(line);
      line = "";
      used = 0;
    }
    if (c !== "\n") {
      line += c;
      used += n;
    }
  }
  return [...lines, line].join("\n");
}
/** Fixed 16:9 financial report: the same geometry drives every visual export. */
export function summaryLayout(d: Dashboard, sections: ReportSection[]) {
  const selected = sections[0]?.title.startsWith("섹터 분석 · ")
    ? d.sectors.find((s) => s.name === sections[0].title.slice(8))
    : undefined;
  const total = selected ?? d,
    stocks = selected?.stocks ?? d.stocks;
  const texts: TextBox[] = [],
    cards: Card[] = [];
  function text(
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size = 14,
    color = ink,
    url?: string,
    abbreviate = false,
  ) {
    let rendered = wrap(value, w, size);
    const limit = Math.floor((h * 72) / (size * 1.18));
    if (abbreviate && rendered.split("\n").length > limit)
      rendered =
        rendered.split("\n").slice(0, limit).join("\n").slice(0, -1) + "…";
    texts.push({ text: rendered, x, y, w, h, size, color, url });
  }
  const card = (x: number, y: number, w: number, h: number, color?: string) =>
    cards.push({ x, y, w, h, color });
  text("국내 주식 포트폴리오 섹터 분석", 0.5, 0.38, 11.6, 0.58, 28, navy);
  text(
    `${d.name}${selected ? " · " + selected.name : ""}`,
    0.5,
    1.05,
    11.4,
    0.5,
    17,
    navy,
  );
  text(`스냅샷 생성 ${d.createdAt}`, 0.5, 1.61, 11.4, 0.32, 15, muted);
  const metrics = [
    ["총평가액", money(total.marketValue)],
    ["매수원금", money(total.cost)],
    ["평가손익", money(total.profit)],
    ["총수익률", percent(total.returnPct)],
  ];
  metrics.forEach(([label, value], i) => {
    const x = 12.25 + i * 3.5;
    card(x, 0.4, 3.36, 1.25);
    text(label, x + 0.18, 0.57, 3, 0.32, 16, muted);
    text(
      value,
      x + 0.18,
      1.02,
      3,
      0.52,
      28,
      i > 1 ? (total.profit != null && total.profit < 0 ? loss : gain) : navy,
    );
  });
  text(
    selected
      ? `선택 섹터 주식 기준 · 정원 내 비중 ${selected.weightPct == null ? "—" : selected.weightPct.toFixed(2) + "%"} · 비주식 자산 미입력`
      : "정원 내 주식 기준 · 비주식 자산 미입력",
    12.25,
    1.77,
    13.8,
    0.32,
    15,
    muted,
  );
  const y = 2.3,
    h = selected ? 6.35 : 5.35,
    gap = 0.22,
    usable = 25.6666666667 - gap * 2,
    widths = [usable * 0.24, usable * 0.38, usable * 0.38];
  const xs = [
    0.5,
    0.5 + widths[0] + gap,
    0.5 + widths[0] + widths[1] + gap * 2,
  ];
  const count = selected ? stocks.length : d.sectors.length;
  const rows = selected
    ? [...stocks].sort((a, b) => descending(a.marketValue, b.marketValue)).map((s) => ({
        ...s,
        weightPct:
          selected.marketValue && s.marketValue != null
            ? (s.marketValue / selected.marketValue) * 100
            : null,
        count: 1,
      }))
    : d.sectors.map((s) => ({ ...s, count: s.stocks.length }));
  const capacity = 8, rowHeight = selected ? 0.60 : 0.45, nameHeight = selected ? 0.60 : 0.42;
  const colors = new Map(
    rows.map((r, i) => [r.name, palette[i % palette.length]]),
  );
  function panel(index: number, title: string, n: number, totalCount: number) {
    card(xs[index], y, widths[index], h);
    text(
      title,
      xs[index] + 0.22,
      y + 0.2,
      widths[index] - 0.44,
      0.42,
      19,
      navy,
    );
    text(
      `${n}/${totalCount} 표시${n < totalCount ? ` · ${totalCount - n}개 생략, MD 전체` : ""}`,
      xs[index] + 0.22,
      y + 0.72,
      widths[index] - 0.44,
      0.32,
      15,
      muted,
    );
  }
  panel(
    0,
    selected ? "1  종목 리스트" : "1  섹터 리스트",
    Math.min(capacity, count),
    count,
  );
  rows.slice(0, capacity).forEach((r, i) => {
    const yy = y + 1.25 + i * rowHeight;
    card(xs[0] + 0.23, yy + 0.08, 0.08, 0.14, colors.get(r.name));
    text(r.name, xs[0] + 0.45, yy, widths[0] - 1.55, nameHeight, 18);
    text(selected ? String(i + 1).padStart(2, "0") : `${r.count}종목`, xs[0] + widths[0] - 1.05, yy, 0.85, 0.3, 15, muted);
  });
  text(
    `총 ${stocks.length}종목 · ${selected ? "선택 섹터" : d.sectors.length + "섹터"}`,
    xs[0] + 0.22,
    y + h - 0.41,
    widths[0] - 0.44,
    0.32,
    15,
    muted,
  );
  function chart(index: number, performance: boolean) {
    const ordered = [...rows].sort((a, b) =>
      descending(
        performance ? a.returnPct : a.weightPct,
        performance ? b.returnPct : b.weightPct,
      ),
    );
    panel(
      index,
      performance
        ? `3  ${selected ? "종목" : "섹터별 포트폴리오"} 성과`
        : `2  ${selected ? "종목" : "섹터별 포트폴리오"} 비중`,
      Math.min(capacity, count),
      count,
    );
    const bx = xs[index] + 3.38,
      bw = widths[index] - 5.45;
    const values = rows.map(
      (r) => (performance ? r.returnPct : r.weightPct) ?? 0,
    );
    const min = performance ? Math.min(0, ...values) : 0,
      max = Math.max(0, ...values),
      range = max - min || 1;
    const zero = bx + ((0 - min) / range) * bw;
    ordered.slice(0, capacity).forEach((r, i) => {
      const yy = y + 1.25 + i * rowHeight,
        v = performance ? r.returnPct : r.weightPct;
      text(r.name, xs[index] + 0.22, yy, 3.02, nameHeight, 18);
      card(bx, yy + 0.11, bw, 0.13, "ECF0F4");
      if (v != null) {
        const end = bx + ((v - min) / range) * bw;
        card(
          Math.min(zero, end),
          yy + 0.11,
          Math.abs(end - zero),
          0.13,
          performance ? (v < 0 ? loss : gain) : colors.get(r.name),
        );
      }
      text(
        performance ? percent(v) : v == null ? "—" : v.toFixed(2) + "%",
        xs[index] + widths[index] - 1.85,
        yy,
        1.63,
        0.29,
        16,
        performance ? (v != null && v < 0 ? loss : gain) : ink,
      );
      if (!performance || selected)
        text(
          money(r.marketValue),
          xs[index] + widths[index] - 1.85,
          yy + 0.26,
          1.63,
          0.23,
          13,
          muted,
        );
    });
    if (performance) {
      card(zero, y + 1.13, 0.012, h - 1.57, "AEB7C2");
      text("0", zero - 0.08, selected ? y + 1.1 : y + h - 0.41, 0.25, 0.22, 11, muted);
    }
    text(
      performance
        ? "손익 합계 / 매수원금 합계 · 공통 선형 축"
        : `${selected ? "섹터 내 " : ""}평가액 기준 · 공통 선형 축 · 금액: 억원`,
      xs[index] + 0.22,
      y + h - 0.33,
      widths[index] - 0.44,
      0.26,
      15,
      muted,
    );
  }
  chart(1, false);
  chart(2, true);
  card(0.5, selected ? 8.9 : 7.9, 25.6666666667, selected ? 5.72 : 6.72);
  if (!selected) {
    const ranked = [...stocks]
      .filter((s) => s.returnPct != null)
      .sort(
        (a, b) =>
          descending(a.returnPct, b.returnPct) ||
          a.ticker.localeCompare(b.ticker),
      );
    const top = ranked.slice(0, Math.min(30, Math.ceil(ranked.length / 2))),
      bottom = ranked.slice(Math.max(top.length, ranked.length - 30)).reverse();
    text("4  종목 수익률 상위·하위", 0.74, 8.03, 12, 0.4, 22, navy);
    text(
      `순위 확인 ${ranked.length}/${stocks.length}종목 · 중복 없음 · ${top.length + bottom.length}/${ranked.length} 표시 · 손익: 억원`,
      0.74,
      8.43,
      24.9,
      0.32,
      15,
      muted,
    );
    [top, bottom].forEach((group, side) => {
      const left = 0.74 + side * 12.72;
      text(
        `${side ? "BOTTOM" : "TOP"} ${group.length}`,
        left,
        8.78,
        12,
        0.32,
        18,
        side ? loss : gain,
      );
      group.forEach((s, i) => {
        const x = left + Math.floor(i / 10) * 4.16,
          yy = 9.13 + (i % 10) * 0.54;
        text(
          String(ranked.indexOf(s) + 1).padStart(2, "0"),
          x,
          yy,
          0.38,
          0.28,
          15,
          muted,
        );
        text(s.name, x + 0.43, yy, 2.35, 0.53, 16);
        text(
          percent(s.returnPct),
          x + 2.88,
          yy,
          1.25,
          0.27,
          15,
          s.returnPct! < 0 ? loss : gain,
        );
        text(money(s.profit), x + 2.88, yy + 0.27, 1.25, 0.25, 13, muted);
      });
    });
  } else {
    const research = sections.filter((s) => s.title.startsWith("공시·뉴스 · "));
    const linked = research.flatMap((s) =>
      s.rows
        .filter((r) => r.url)
        .map((r) => {
          const parts = r.text.split(" · "),
            source = parts.pop();
          return {
            text: `${source} · ${s.title.replace("공시·뉴스 · ", "")} · ${parts.join(" · ")}`,
            url: r.url,
            disclosure: r.text.startsWith("공시 | "),
          };
        }),
    ).sort((a, b) => Number(b.disclosure) - Number(a.disclosure));
    const missing = research.filter((s) =>
      s.rows.some((r) => /미조회|조회실패|조회 실패/.test(r.text)),
    ).length;
    text(
      "4  종목별 공시·뉴스 · 공시 우선 (유형 내 보고서 순)",
      0.74,
      9.03,
      24,
      0.4,
      20,
      navy,
    );
    text(
      `${Math.min(6, linked.length)}/${linked.length} 표시 · ${missing}/${stocks.length}종목 미조회·조회실패 포함 · 제목 링크는 원문 연결`,
      0.74,
      9.56,
      24,
      0.32,
      15,
      muted,
    );
    if (!linked.length)
      text(
        "표시할 링크 없음 · 미조회와 조회 결과 없음을 구분한 전체 내용은 MD 참조",
        0.74,
        10.2,
        24,
        0.4,
        15,
        muted,
      );
    linked
      .slice(0, 6)
      .forEach((r, i) =>
        text(
          r.text,
          0.74 + (i % 2) * 12.72,
          10.10 + Math.floor(i / 2) * 0.98,
          12.1,
          0.86,
          15,
          ink,
          r.url,
          true,
        ),
      );
    text(
      "과거 공시 포함 · 최신·완전성 보장 없음 · 긴 제목만 …로 축약 · MD에 전체 제목·종목·출처",
      0.74,
      13.12,
      24,
      0.32,
      15,
      muted,
    );
    const provenance = sections.find(s => s.title === "공시·뉴스 출처와 한계");
    const dates = [...new Set(provenance?.rows.flatMap(r => [...r.text.matchAll(/DB 최신 공시일 (\S+)/g)].map(m => m[1])) ?? [])];
    text(`DB 최신 공시일 ${dates.join(" / ") || "미확인"} · 게시 스냅샷은 실시간 공시가 아닙니다`, 0.74, 13.54, 24.9, 0.32, 15, muted);
    text(provenance?.rows[0]?.text ?? "공시·뉴스 미조회/조회실패", 0.74, 13.96, 24.9, 0.52, 15, muted);
  }
  text(
    "수익률: 매수원금 대비 · 배당·수수료·세금 제외 · 억원/수익률 소수 둘째 자리 반올림 · 비주식 미수집",
    0.5,
    14.68,
    25.6,
    0.32,
    15,
    muted,
  );
  return { width: W, height: H, texts, cards };
}
let fontPromise: Promise<string> | undefined;
async function loadFont() {
  fontPromise ??= fetch("/fonts/NotoSansKR-Regular.ttf", {
    signal: AbortSignal.timeout(15000),
  })
    .then(async (r) => {
      if (!r.ok) throw new Error("한글 글꼴을 불러오지 못했습니다.");
      const bytes = new Uint8Array(await r.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    })
    .catch((error) => {
      fontPromise = undefined;
      throw error;
    });
  return fontPromise;
}
export async function exportReport(
  format: ExportFormat,
  d: Dashboard,
  sections: ReportSection[],
  fontBase64?: string,
): Promise<Blob> {
  if (format === "md")
    return new Blob([reportMarkdown(d, sections)], {
      type: "text/markdown;charset=utf-8",
    });
  const scene = summaryLayout(d, sections);
  if (format === "png") {
    const font = new FontFace(
      "DashboardNoto",
      `url(data:font/ttf;base64,${fontBase64 ?? (await loadFont())})`,
    );
    await font.load();
    document.fonts.add(font);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 3840;
      canvas.height = 2160;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("PNG canvas unavailable");
      const scale = canvas.width / W;
      ctx.scale(scale, scale);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      for (const c of scene.cards) {
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, c.w, c.h, c.color ? 0 : 0.04);
        ctx.fillStyle = "#" + (c.color ?? "FFFFFF");
        ctx.fill();
        if (!c.color) {
          ctx.strokeStyle = "#DCE2E8";
          ctx.lineWidth = 0.008;
          ctx.stroke();
        }
      }
      for (const t of scene.texts) {
        ctx.font = `${t.size / 72}px DashboardNoto`;
        ctx.fillStyle = "#" + t.color;
        ctx.textBaseline = "alphabetic";
        t.text
          .split("\n")
          .forEach((line, i) =>
            ctx.fillText(line, t.x, t.y + (t.size / 72) * (0.92 + i * 1.18)),
          );
      }
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("PNG encoding failed")),
          "image/png",
        ),
      );
    } finally {
      document.fonts.delete(font);
    }
  }
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "in",
      format: [W, H],
    });
    pdf.addFileToVFS("NotoSansKR.ttf", fontBase64 ?? (await loadFont()));
    pdf.addFont("NotoSansKR.ttf", "NotoSansKR", "normal");
    pdf.setFont("NotoSansKR");
    pdf.setFillColor("#FFFFFF");
    pdf.rect(0, 0, W, H, "F");
    for (const c of scene.cards) {
      pdf.setFillColor("#" + (c.color ?? "FFFFFF"));
      pdf.setDrawColor("#DCE2E8");
      pdf.setLineWidth(0.008);
      if (c.color) pdf.rect(c.x, c.y, c.w, c.h, "F");
      else pdf.roundedRect(c.x, c.y, c.w, c.h, 0.04, 0.04, "FD");
    }
    for (const t of scene.texts) {
      pdf.setFontSize(t.size);
      pdf.setTextColor("#" + t.color);
      pdf.text(t.text, t.x, t.y + (t.size / 72) * 0.92, {
        lineHeightFactor: 1.18,
      });
      if (t.url) pdf.link(t.x, t.y, t.w, t.h, { url: t.url });
    }
    return pdf.output("blob");
  }
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "FINANCIAL", width: W, height: H });
  pptx.layout = "FINANCIAL";
  pptx.author = "그루밭";
  pptx.title = d.name;
  pptx.subject = "가로 한 장 요약";
  pptx.theme = { headFontFace: "Noto Sans KR", bodyFontFace: "Noto Sans KR" };
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  for (const c of scene.cards)
    slide.addShape(c.color ? pptx.ShapeType.rect : pptx.ShapeType.roundRect, {
      x: c.x,
      y: c.y,
      w: c.w,
      h: c.h,
      rectRadius: 0.04,
      fill: { color: c.color ?? "FFFFFF" },
      line: { color: c.color ?? "DCE2E8", width: 0.5 },
    });
  for (const t of scene.texts)
    slide.addText(t.text, {
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
      fontSize: t.size,
      color: t.color,
      margin: 0,
      valign: "top",
      breakLine: false,
      hyperlink: t.url ? { url: t.url } : undefined,
    });
  return (await pptx.write({ outputType: "blob" })) as Blob;
}
