// Uses the production exporter and explicitly synthetic test inputs, never user storage.
import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.DASHBOARD_ARTIFACT_DIR;
if (!out)
  throw new Error(
    "DASHBOARD_ARTIFACT_DIR required; first run export tests with it set",
  );
const bundled = await build({
  entryPoints: ["src/lib/dashboard-export.ts"],
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "DashboardExports",
  write: false,
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.DASHBOARD_BASE_URL ?? "http://localhost:3112");
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const font = await readFile("public/fonts/NotoSansKR-Regular.ttf", "base64");
  for (const scope of ["overview", "sector"]) {
    const input = JSON.parse(
      await readFile(`${out}/${scope}.input.json`, "utf8"),
    );
    const encoded = await page.evaluate(
      async ({ input, font }) => {
        const blob = await window.DashboardExports.exportReport(
          "png",
          input.d,
          input.sections,
          font,
        );
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(blob);
        });
      },
      { input, font },
    );
    const bytes = Buffer.from(encoded, "base64");
    assert.equal(bytes.readUInt32BE(16), 3840);
    assert.equal(bytes.readUInt32BE(20), 2160);
    await writeFile(`${out}/${scope}.png`, bytes);
  }
  assert.deepEqual(errors, []);
  console.log(
    "Synthetic overview/sector PNG: 3840x2160; production exporter; no pageerrors",
  );
} finally {
  await browser.close();
}
