import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const origin=process.argv[2]||'http://127.0.0.1:3002';
const out=process.env.SANCTUARY_CAPTURE||process.env.TMPDIR;
if(!out)throw new Error('Set SANCTUARY_CAPTURE to an output directory');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(/Sanctuary\/StillWater.*not supported|Shader error in/.test(m.text()))errors.push(m.text());});
try {
 await page.goto(`${origin}/sanctuary/005930`);
 await page.locator('#enter').click();
 await page.locator('#load-panel').waitFor({state:'hidden',timeout:120000});
 await page.waitForTimeout(3000);
 const posterStyle=await page.addStyleTag({content:'.scene-title,.scene-caption{visibility:hidden!important}'});
 await page.locator('#unity-canvas').screenshot({path:join(out,'sanctuary-garden-canvas.png')});
 await posterStyle.evaluate(el=>el.remove());
 await page.screenshot({path:join(out,'sanctuary-garden-desktop.png')});
 for(const place of ['hall','forest']) {
  await page.locator(`[data-place="${place}"]`).click();await page.waitForTimeout(2400);
  await page.locator('#unity-canvas').screenshot({path:join(out,`sanctuary-${place}.png`)});
 }
 await page.locator('[data-place="courtyard"]').click();
 await page.locator('#day').selectOption('0.78');await page.waitForTimeout(2400);
 await page.locator('#unity-canvas').screenshot({path:join(out,'sanctuary-evening.png')});
 await page.locator('#day').selectOption('0.5');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1500);
 await page.screenshot({path:join(out,'sanctuary-garden-mobile.png'),fullPage:true});
 console.log(JSON.stringify({origin,out,errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
 if(errors.length)process.exitCode=1;
} finally {await browser.close();}
