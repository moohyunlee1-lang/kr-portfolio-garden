// Run against a built local server. Uses an isolated browser context, never your saved portfolios.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const base = process.env.DASHBOARD_BASE_URL ?? "http://localhost:3107";
const out = process.env.DASHBOARD_ARTIFACT_DIR;
if (!out)
  throw new Error("Set DASHBOARD_ARTIFACT_DIR to an evidence directory");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().includes("/api/dashboard-research")) requests.push(r.url());
});
const evidence = { base, requests, errors, viewports: [], downloads: [] };
try {
  await page.goto(base);
  await page.getByRole("button", { name: "대시보드 생성하기" }).waitFor();
  assert.equal(requests.length, 0);
  await page.getByRole("button", { name: "샘플 정원 보기" }).click();
  await page.getByRole("heading", { name: "샘플 정원", exact: true }).waitFor();
  await page.getByRole("button", { name: "대시보드 생성하기" }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(requests.length, 0);
  async function measure(label) {
    const box = await page.evaluate(() => ({
      width: innerWidth,
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      dialog: document
        .querySelector("[role=dialog]")
        .getBoundingClientRect()
        .toJSON(),
    }));
    assert.equal(box.scroll, box.client, `${label}: horizontal overflow`);
    evidence.viewports.push({ label, ...box });
    await page.screenshot({ path: path.join(out, `${label}.png`) });
  }
  await measure("overview-desktop");
  async function save(scope, format) {
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: `${format.toUpperCase()} ${format === "md" ? "전체" : "가로 한 장"} 다운로드`,
        exact: true,
      })
      .click();
    const file = await downloading;
    const target = path.join(out, `${scope}.${format}`);
    await file.saveAs(target);
    evidence.downloads.push(target);
    if (format === "png") {
      const { readFile } = await import("node:fs/promises");
      const bytes = await readFile(target);
      assert.equal(bytes.readUInt32BE(16), 3840);
      assert.equal(bytes.readUInt32BE(20), 2160);
    }
  }
  for (const format of ["pdf", "pptx", "png", "md"])
    await save("browser-overview", format);
  // Real file download fallback and native-sharing payload contract; no real recipient is contacted.
  const fallback = page.waitForEvent("download");
  await page.getByRole("button", { name: /생성 파일 공유/ }).click();
  await (await fallback).saveAs(path.join(out, "share-fallback.md"));
  await page.evaluate(() => {
    window.__sharePayload = null;
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (p) => {
        window.__sharePayload = {
          files: p.files.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
          })),
          hasUrl: "url" in p,
        };
      },
    });
  });
  await page.getByRole("button", { name: /생성 파일 공유/ }).click();
  evidence.nativeShare = await page.evaluate(() => window.__sharePayload);
  assert.equal(evidence.nativeShare.hasUrl, false);
  assert.equal(evidence.nativeShare.files.length, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await measure("overview-mobile");
  for (const format of ["pdf", "pptx", "png", "md"])
    await save("browser-overview-mobile", format);
  // Representative industries are not investment themes; select an actual group.
  const sectors = await page.locator('[role=dialog] button[aria-label$=" 분석"]').evaluateAll((buttons) =>
    buttons.map((button) => ({ name: button.getAttribute("aria-label"), count: Number(button.textContent.match(/(\d+)종목/)?.[1] ?? 0) })),
  );
  const largest = sectors.sort((a, b) => b.count - a.count)[0];
  assert(largest?.name, "No representative industry available");
  evidence.selectedSector = largest;
  await page.getByRole("button", { name: largest.name, exact: true }).click();
  await page
    .getByText(/DB 최신 공시일/)
    .first()
    .waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: "PDF 가로 한 장 다운로드" }).waitFor();
  await page.waitForFunction(() => !document.querySelector("[role=status]"));
  evidence.linkCount = await page
    .locator('[role=dialog] a[href^="https://"]')
    .count();
  assert(evidence.linkCount > 0);
  await page.evaluate(() =>
    document.querySelector("[role=dialog]").parentElement.scrollTo(0, 0),
  );
  await measure("sector-mobile");
  for (const format of ["pdf", "pptx", "png", "md"])
    await save("browser-sector", format);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("heading", { name: "종목별 중요공시 · 뉴스", exact: true })
    .scrollIntoViewIfNeeded();
  await measure("sector-news-desktop");
  for (const format of ["pdf", "pptx", "png", "md"])
    await save("browser-sector-desktop", format);
  await page.getByRole("button", { name: "시세 새로고침 · 재생성" }).click();
  await page.getByText(/새로 조회 성공/).waitFor({ timeout: 90000 });
  assert.equal(
    await page
      .getByRole("heading", { name: "정원 대시보드", exact: true })
      .count(),
    1,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "대시보드 생성하기",
  );
  evidence.storageKeys = await page.evaluate(() => Object.keys(localStorage));
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await writeFile(
    path.join(out, "browser-evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
  await browser.close();
}
